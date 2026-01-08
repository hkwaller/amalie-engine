# AI Instructions: Building a Quiz Game with amalie-engine

> Use this document as context when starting a new project that uses the `amalie-engine` package.

## Overview

`amalie-engine` is a TypeScript quiz game engine with Supabase Realtime integration. It provides React hooks for both host and player experiences, configurable scoring, power-ups, and multiple question types.

## Quick Reference

### Installation

```bash
npm install amalie-engine @supabase/supabase-js
```

### Core Exports

```typescript
// Main hooks and provider
import { useQuizHost, useQuizPlayer, useScoreboard, QuizProvider } from 'amalie-engine'

// Question providers
import { JsonArrayProvider, JsonUrlProvider, SupabaseQuestionProvider } from 'amalie-engine'

// Types
import type { Question, QuizGameConfig, Player, GameState, ScoringConfig } from 'amalie-engine'

// Utilities
import { generateRoomCode, generateJoinUrl } from 'amalie-engine'

// Components (optional - requires qrcode.react)
import { RoomQRCode } from 'amalie-engine/components'
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        HOST DEVICE                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              useQuizHost Hook                            ││
│  │  - Manages game state machine                            ││
│  │  - Loads questions from array or provider                ││
│  │  - Calculates scores                                     ││
│  │  - Broadcasts state to players                           ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Supabase Realtime
                              │ (Broadcast + Presence)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      PLAYER DEVICES                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              useQuizPlayer Hook                          ││
│  │  - Receives game state from host                         ││
│  │  - Submits answers                                       ││
│  │  - Manages player identity (auto-persisted)              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Required Setup

### 1. Supabase Project

The game requires a Supabase project with Realtime enabled. No database tables are required for basic functionality.

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### 2. QuizProvider Wrapper

Wrap the app (or relevant pages) with QuizProvider:

```tsx
import { QuizProvider } from 'amalie-engine'
import { supabaseClient } from '@/lib/supabase'

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <QuizProvider supabaseClient={supabaseClient}>
      {children}
    </QuizProvider>
  )
}
```

## Question Types

The engine supports 3 answer types:

| Answer Type | Description | Key Fields |
|-------------|-------------|------------|
| `multiple-choice` | Standard A/B/C/D options | `options: string[]`, `correctOptionIndex: number` |
| `text` | Free-form text input | `correctText: string`, `acceptedAnswers?: string[]` |
| `numeric` | Number/estimation (closest wins) | `correctNumber: number`, `lowerBound?`, `upperBound?` |

### Question Structure

```typescript
interface Question {
  id: string
  category: string                           // Required
  text: string                               // The question text
  answerType: 'multiple-choice' | 'text' | 'numeric'
  difficulty?: 'easy' | 'medium' | 'hard'
  
  // For multiple-choice
  options?: string[]
  correctOptionIndex?: number                // 0-based index
  
  // For text answers
  correctText?: string
  acceptedAnswers?: string[]                 // Aliases: ["USA", "United States", "US"]
  caseSensitive?: boolean
  
  // For numeric/estimation
  correctNumber?: number
  lowerBound?: number                        // For normalized scoring
  upperBound?: number
  
  // Media
  media?: {
    type: 'image' | 'audio' | 'video'
    url: string
    autoplay?: boolean
    showDuring?: 'question' | 'answer' | 'both'
  }
  
  // Per-question overrides
  timeLimit?: number                         // Seconds
  points?: number                            // Override base points
  
  // Custom data
  extraInfo?: Record<string, unknown>
}
```

### Question Examples

```typescript
// Multiple Choice
{
  id: '1',
  category: 'Geography',
  text: 'What is the capital of France?',
  answerType: 'multiple-choice',
  options: ['London', 'Berlin', 'Paris', 'Madrid'],
  correctOptionIndex: 2,  // Paris
  difficulty: 'easy',
}

// Text Answer
{
  id: '2',
  category: 'Science',
  text: 'What planet is known as the Red Planet?',
  answerType: 'text',
  correctText: 'Mars',
  acceptedAnswers: ['mars', 'Mars', 'MARS'],
  caseSensitive: false,
}

// Numeric/Estimation (golf scoring - lower is better)
{
  id: '3',
  category: 'History',
  text: 'In what year did World War II end?',
  answerType: 'numeric',
  correctNumber: 1945,
}

// With Media
{
  id: '4',
  category: 'Music',
  text: 'Name this song',
  answerType: 'text',
  correctText: 'Bohemian Rhapsody',
  acceptedAnswers: ['bohemian rhapsody', 'Bohemian Rhapsody'],
  media: {
    type: 'audio',
    url: '/audio/clip.mp3',
    autoplay: true,
    showDuring: 'question',
  },
}
```

## Host Page Implementation

```tsx
'use client'

import { useQuizHost } from 'amalie-engine'
import { supabaseClient } from '@/lib/supabase'
import type { Question, QuizGameConfig } from 'amalie-engine'

const questions: Question[] = [
  {
    id: '1',
    category: 'Geography',
    text: 'What is the capital of France?',
    answerType: 'multiple-choice',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    correctOptionIndex: 2,
  },
  {
    id: '2',
    category: 'Science',
    text: 'What is H2O commonly known as?',
    answerType: 'text',
    correctText: 'Water',
    acceptedAnswers: ['water', 'Water', 'WATER'],
  },
]

const config: QuizGameConfig = {
  scoring: {
    basePoints: 1000,
    timeBonus: { enabled: true, maxBonus: 500, decayPerSecond: 50 },
    streakBonus: { enabled: true, multiplierPerStreak: 0.1, maxMultiplier: 2 },
  },
  questionTimeLimit: 30,
  autoAdvanceOnAllAnswered: false,
  shuffleQuestions: false,
}

export default function HostPage() {
  const {
    // State
    gameState,           // 'lobby' | 'playing' | 'revealing' | 'finished'
    currentQuestion,     // { question, questionIndex, totalQuestions, startedAt, answers }
    currentCategory,     // string | null
    players,             // Player[]
    scoreboard,          // ScoreboardEntry[]
    answers,             // PlayerAnswer[]
    allPlayersAnswered,  // boolean
    
    // Actions
    startGame,           // () => Promise<void>
    nextQuestion,        // () => Promise<void>
    replaceQuestion,     // () => Promise<void>
    revealAnswer,        // () => void
    endRound,            // () => void - force end current round
    endGame,             // () => void
    rematch,             // () => Promise<void>
    
    // Player management
    kickPlayer,          // (playerId: string) => void
    adjustScore,         // (playerId: string, points: number) => void
    addPlayer,           // (name: string) => void
    
    // Room
    roomCode,            // string
    joinUrl,             // string
    
    // Categories
    availableCategories, // string[]
    selectCategories,    // (categories: string[]) => void
    
    // Connection
    isConnected,         // boolean
    error,               // Error | null
  } = useQuizHost({
    supabaseClient,
    config,
    questions,  // Can also be a QuestionProvider
    baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
    onGameEnd: (results) => console.log('Game ended', results),
    onRematch: (previousResults) => console.log('Rematch started', previousResults),
  })

  // Render based on gameState
  if (gameState === 'lobby') {
    return (
      <div>
        <h1>Room: {roomCode}</h1>
        <p>Join at: {joinUrl}</p>
        <h2>Players ({players.length})</h2>
        <ul>
          {players.map(p => <li key={p.id}>{p.name}</li>)}
        </ul>
        <button onClick={startGame} disabled={players.length === 0}>
          Start Game
        </button>
      </div>
    )
  }

  if (gameState === 'playing' && currentQuestion) {
    return (
      <div>
        <h2>Question {currentQuestion.questionIndex + 1}/{currentQuestion.totalQuestions}</h2>
        <p>{currentQuestion.question.text}</p>
        {currentQuestion.question.options?.map((opt, i) => (
          <div key={i}>{opt}</div>
        ))}
        <p>Answers: {answers.length}/{players.length}</p>
        {allPlayersAnswered && <p>All players answered!</p>}
        <button onClick={endRound}>End Round</button>
        <button onClick={revealAnswer}>Reveal Answer</button>
      </div>
    )
  }

  if (gameState === 'revealing') {
    return (
      <div>
        <h2>Correct Answer: {currentQuestion?.question.correctText || 
          currentQuestion?.question.options?.[currentQuestion.question.correctOptionIndex!]}</h2>
        <h3>Scoreboard</h3>
        {scoreboard.map(entry => (
          <div key={entry.playerId}>
            #{entry.rank} {entry.playerName}: {entry.score}
          </div>
        ))}
        <button onClick={nextQuestion}>Next Question</button>
      </div>
    )
  }

  if (gameState === 'finished') {
    return (
      <div>
        <h1>Game Over!</h1>
        <h2>Final Scores</h2>
        {scoreboard.map(entry => (
          <div key={entry.playerId}>
            #{entry.rank} {entry.playerName}: {entry.score}
          </div>
        ))}
        <button onClick={rematch}>Play Again</button>
      </div>
    )
  }

  return <div>Loading...</div>
}
```

## Player Page Implementation

**Important:** `useQuizPlayer` automatically joins the game when the component mounts with a valid `roomCode` and `playerName`. There is no separate `joinGame` function.

```tsx
'use client'

import { useState } from 'react'
import { useQuizPlayer } from 'amalie-engine'
import { supabaseClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'

export default function PlayerPage() {
  const searchParams = useSearchParams()
  const roomCodeFromUrl = searchParams.get('room')
  
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState(roomCodeFromUrl || '')
  const [hasJoined, setHasJoined] = useState(false)

  // Only render the hook after player has entered name
  if (!hasJoined) {
    return (
      <div>
        <h1>Join Game</h1>
        <input
          placeholder="Your name"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
        />
        {!roomCodeFromUrl && (
          <input
            placeholder="Room code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          />
        )}
        <button 
          onClick={() => setHasJoined(true)}
          disabled={!playerName || !roomCode}
        >
          Join
        </button>
      </div>
    )
  }

  return <GamePlay supabaseClient={supabaseClient} roomCode={roomCode} playerName={playerName} />
}

// Separate component so hook only mounts after join
function GamePlay({ supabaseClient, roomCode, playerName }: {
  supabaseClient: any
  roomCode: string
  playerName: string
}) {
  const {
    // State
    gameState,              // 'lobby' | 'playing' | 'revealing' | 'finished'
    currentQuestion,        // Question without answer fields (stripped for security)
    currentCategory,        // string | null
    myScore,                // number
    myRank,                 // number
    hasAnswered,            // boolean
    answerRejected,         // boolean (late/duplicate answer)
    questionTimeRemaining,  // number | null (ms)
    
    // Power-ups
    availablePowerups,      // PowerupDefinition[]
    activePowerup,          // PowerupDefinition | null
    
    // Actions
    submitAnswer,           // (answer: string | number) => void
    activatePowerup,        // (powerupId: string) => void
    reconnect,              // () => void
    
    // Connection
    isConnected,            // boolean
    isReconnecting,         // boolean
    connectionError,        // Error | null
  } = useQuizPlayer({
    supabaseClient,
    roomCode,
    playerName,
  })

  if (connectionError) {
    return (
      <div>
        <p>Error: {connectionError.message}</p>
        <button onClick={reconnect}>Reconnect</button>
      </div>
    )
  }

  if (gameState === 'lobby') {
    return (
      <div>
        <h1>Welcome, {playerName}!</h1>
        <p>Waiting for host to start the game...</p>
        <p>Your score: {myScore}</p>
      </div>
    )
  }

  if (gameState === 'playing' && currentQuestion) {
    const timeLeft = questionTimeRemaining ? Math.ceil(questionTimeRemaining / 1000) : null

    return (
      <div>
        {timeLeft !== null && <p>Time: {timeLeft}s</p>}
        <h2>{currentQuestion.text}</h2>
        
        {/* Multiple Choice */}
        {currentQuestion.answerType === 'multiple-choice' && currentQuestion.options && (
          <div>
            {currentQuestion.options.map((option, index) => (
              <button
                key={index}
                onClick={() => submitAnswer(index)}
                disabled={hasAnswered}
              >
                {option}
              </button>
            ))}
          </div>
        )}
        
        {/* Text Input */}
        {currentQuestion.answerType === 'text' && (
          <TextAnswerInput 
            onSubmit={submitAnswer} 
            disabled={hasAnswered} 
          />
        )}
        
        {/* Numeric Input */}
        {currentQuestion.answerType === 'numeric' && (
          <NumericAnswerInput 
            onSubmit={submitAnswer} 
            disabled={hasAnswered} 
          />
        )}
        
        {hasAnswered && <p>Answer submitted! Waiting for others...</p>}
        {answerRejected && <p>Answer rejected (too late or already answered)</p>}
      </div>
    )
  }

  if (gameState === 'revealing') {
    return (
      <div>
        <h2>Results</h2>
        <p>Your score: {myScore}</p>
        <p>Your rank: #{myRank}</p>
      </div>
    )
  }

  if (gameState === 'finished') {
    return (
      <div>
        <h1>Game Over!</h1>
        <p>Final score: {myScore}</p>
        <p>Final rank: #{myRank}</p>
      </div>
    )
  }

  return <div>Connecting...</div>
}

// Helper components
function TextAnswerInput({ onSubmit, disabled }: { onSubmit: (answer: string) => void, disabled: boolean }) {
  const [value, setValue] = useState('')
  return (
    <div>
      <input 
        value={value} 
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Type your answer"
      />
      <button onClick={() => onSubmit(value)} disabled={disabled || !value}>
        Submit
      </button>
    </div>
  )
}

function NumericAnswerInput({ onSubmit, disabled }: { onSubmit: (answer: number) => void, disabled: boolean }) {
  const [value, setValue] = useState('')
  return (
    <div>
      <input 
        type="number"
        value={value} 
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder="Enter a number"
      />
      <button onClick={() => onSubmit(Number(value))} disabled={disabled || !value}>
        Submit
      </button>
    </div>
  )
}
```

## Game Flow

```
1. LOBBY
   - Host creates game, gets roomCode and joinUrl
   - Players navigate to joinUrl (or enter room code manually)
   - Players enter name and hook auto-joins
   - Host sees player list
   - Host clicks "Start Game"

2. PLAYING (per question)
   - Question displayed to all
   - Timer counts down (questionTimeRemaining on player)
   - Players submit answers (submitAnswer)
   - Host sees answers array fill up
   - allPlayersAnswered becomes true when everyone answers
   - Host can "End Round" early OR wait for timer

3. REVEALING
   - revealAnswer() or endRound() transitions to this phase
   - Full question (with answers) available to host
   - Points awarded, scoreboard updated
   - Host clicks "Next Question" or game auto-ends

4. FINISHED
   - Final scoreboard displayed
   - Host can start "Rematch" (resets scores, keeps players)
```

## Configuration Reference

### UseQuizHostOptions

```typescript
interface UseQuizHostOptions {
  supabaseClient: SupabaseClient     // Your Supabase client
  config: QuizGameConfig             // Game configuration
  questions: Question[] | QuestionProvider  // Question source
  baseUrl?: string                   // For generating join URLs
  onGameEnd?: (results: ScoreboardEntry[]) => void
  onRematch?: (previousResults: ScoreboardEntry[]) => void
}
```

### QuizGameConfig

```typescript
interface QuizGameConfig {
  roomCode?: string                  // Auto-generated if not provided
  
  scoring: ScoringConfig             // Required
  powerups?: PowerupDefinition[]     // Optional power-ups
  
  // Game flow
  questionTimeLimit?: number         // Seconds per question
  showAnswerAfterQuestion?: boolean
  autoAdvance?: boolean              // Host manually advances if false
  
  // Answer timing
  answerMode?: 'all-players' | 'first-to-answer'
  allowLateAnswers?: boolean
  autoAdvanceOnAllAnswered?: boolean // Auto-reveal when all players answer
  
  // Question settings
  shuffleQuestions?: boolean
  questionsPerGame?: number          // Limit number of questions
}
```

### ScoringConfig

```typescript
interface ScoringConfig {
  basePoints: number                 // Points for correct answer
  
  timeBonus?: {
    enabled: boolean
    maxBonus: number                 // Max bonus points
    decayPerSecond: number           // Points lost per second
  }
  
  streakBonus?: {
    enabled: boolean
    multiplierPerStreak: number      // e.g., 0.1 = +10% per streak
    maxMultiplier: number            // Cap on multiplier
  }
  
  difficultyMultipliers?: {
    easy: number                     // e.g., 0.5
    medium: number                   // e.g., 1.0
    hard: number                     // e.g., 1.5
  }
  
  // For numeric/estimation (golf scoring)
  estimation?: {
    exactMatchBonus: number          // Bonus for exact answer
    capAtMax: boolean
    maxScore: number                 // Worst possible score
    minScore: number                 // Best possible (non-exact) score
  }
}
```

### UseQuizPlayerOptions

```typescript
interface UseQuizPlayerOptions {
  supabaseClient: SupabaseClient     // Your Supabase client
  roomCode: string                   // Room to join
  playerName: string                 // Display name
}
```

## Common Patterns

### Using Question Providers

```typescript
// From array (simplest)
const { ... } = useQuizHost({
  supabaseClient,
  config,
  questions: myQuestionArray,
  baseUrl: window.location.origin,
})

// From JSON URL
import { JsonUrlProvider } from 'amalie-engine'

const provider = new JsonUrlProvider('https://api.example.com/questions.json')
const { ... } = useQuizHost({
  supabaseClient,
  config,
  questions: provider,
  baseUrl: window.location.origin,
})

// From Supabase table
import { SupabaseQuestionProvider } from 'amalie-engine'

const provider = new SupabaseQuestionProvider(supabaseClient, {
  table: 'questions',
  category: 'science',    // Optional filter
  difficulty: 'medium',   // Optional filter
  limit: 20,              // Optional limit
})
```

### QR Code for Easy Joining

```tsx
import { RoomQRCode } from 'amalie-engine/components'

// In host page
<RoomQRCode joinUrl={joinUrl} size={200} />
```

### Custom Scoreboard Display

```tsx
const { scoreboard } = useQuizHost({ ... })

// scoreboard is: ScoreboardEntry[]
// { playerId, playerName, score, rank, streak, lastAnswerCorrect?, pointsThisRound? }

<div className="scoreboard">
  {scoreboard.map((entry) => (
    <div key={entry.playerId} className="player-row">
      <span className="rank">#{entry.rank}</span>
      <span className="name">{entry.playerName}</span>
      <span className="score">{entry.score}</span>
      {entry.streak > 1 && <span className="streak">🔥 {entry.streak}</span>}
    </div>
  ))}
</div>
```

### Category Selection

```tsx
const { availableCategories, selectCategories, startGame } = useQuizHost({ ... })

// Let host pick categories before starting
<div>
  {availableCategories.map(cat => (
    <label key={cat}>
      <input 
        type="checkbox" 
        onChange={(e) => {
          const selected = e.target.checked 
            ? [...selectedCats, cat]
            : selectedCats.filter(c => c !== cat)
          selectCategories(selected)
        }}
      />
      {cat}
    </label>
  ))}
  <button onClick={startGame}>Start with Selected Categories</button>
</div>
```

## File Structure Recommendation

```
app/
├── layout.tsx          # QuizProvider wrapper
├── page.tsx            # Landing page
├── host/
│   └── page.tsx        # Host game screen
├── play/
│   └── page.tsx        # Player join & play screen
└── lib/
    ├── supabase.ts     # Supabase client
    └── questions.ts    # Question data
```

## Styling Notes

- The engine is **headless** - no built-in styles
- Build your own UI components
- Consider:
  - Large, readable text for projector/TV display
  - Mobile-friendly player interface
  - Clear visual feedback for answers
  - Animated transitions between states
  - Sound effects for timer/correct/wrong

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Players can't join | Check Supabase Realtime is enabled in project settings |
| "useQuizContext must be used within QuizProvider" | Wrap your app with `<QuizProvider supabaseClient={...}>` |
| Questions don't load | Verify question format matches `Question` interface |
| Scores not updating | Ensure `revealAnswer()` is called after each question |
| State out of sync | Host is source of truth; players receive via broadcast |
| Player disconnected | They can refresh - identity persists in localStorage |

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Prompt Template

When starting a new quiz game project, use this prompt:

```
I want to build a quiz game using the amalie-engine npm package. 

The game should:
- [Describe your game theme/concept]
- [Number of questions or question source]
- [Any special scoring rules]
- [Target platform: web, mobile, both]
- [Design style preferences]

Please help me:
1. Set up the Next.js project with Supabase
2. Create the host page with game controls
3. Create the player page with join flow
4. Style it with [Tailwind/CSS/your preference]
5. Add [any special features]

Reference the AI_INSTRUCTIONS.md in the amalie-engine repo for implementation details.
```
