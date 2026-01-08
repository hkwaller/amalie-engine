# Amalie Engine

A TypeScript quiz game engine with Supabase Realtime integration, React hooks for Next.js apps, configurable scoring systems, and power-up support.

## Features

- 🎮 **Complete Game Engine** - State machine handling lobby, playing, revealing, and finished phases
- ⚡ **Supabase Realtime** - Built-in adapter for real-time multiplayer communication
- 🎯 **Multiple Question Types** - Multiple choice, text input, and numeric/estimation questions
- 🏆 **Flexible Scoring** - Time bonuses, streak multipliers, difficulty modifiers, and golf-style estimation scoring
- 💪 **Power-ups** - Built-in power-ups like double points, 50/50, extra time, and shields
- 🔌 **React Hooks** - `useQuizHost` and `useQuizPlayer` hooks for easy integration
- 📱 **QR Code Component** - Easy player joining with QR codes
- 🔄 **Reconnection Support** - Player identity persistence and automatic reconnection
- 📦 **Lightweight** - Minimal dependencies, tree-shakeable exports

## Installation

```bash
npm install amalie-engine @supabase/supabase-js
# or
yarn add amalie-engine @supabase/supabase-js
# or
pnpm add amalie-engine @supabase/supabase-js
```

### Optional Dependencies

For QR code support:

```bash
npm install qrcode.react
```

## Quick Start

### 1. Set up the Provider

```tsx
// app/providers.tsx
import { QuizProvider } from 'amalie-engine'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export function Providers({ children }: { children: React.ReactNode }) {
  return <QuizProvider supabaseClient={supabase}>{children}</QuizProvider>
}
```

### 2. Create the Host Screen

```tsx
// app/host/page.tsx
import { useQuizHost, RoomQRCode, type Question } from 'amalie-engine'

const questions: Question[] = [
  {
    id: '1',
    category: 'Science',
    text: 'What is the chemical symbol for gold?',
    answerType: 'multiple-choice',
    options: ['Ag', 'Au', 'Fe', 'Cu'],
    correctOptionIndex: 1,
    difficulty: 'easy',
  },
  // ... more questions
]

export default function HostPage() {
  const {
    gameState,
    currentQuestion,
    players,
    scoreboard,
    roomCode,
    joinUrl,
    startGame,
    nextQuestion,
    revealAnswer,
    endGame,
    rematch,
    isConnected,
  } = useQuizHost({
    supabaseClient: supabase,
    config: {
      scoring: {
        basePoints: 100,
        timeBonus: { enabled: true, maxBonus: 50, decayPerSecond: 5 },
        streakBonus: { enabled: true, multiplierPerStreak: 0.1, maxMultiplier: 2 },
      },
      questionTimeLimit: 20,
      showAnswerAfterQuestion: true,
    },
    questions,
    baseUrl: 'https://myquiz.com/play',
  })

  if (gameState === 'lobby') {
    return (
      <div>
        <h1>Room: {roomCode}</h1>
        <RoomQRCode roomCode={roomCode} baseUrl="https://myquiz.com/play" />
        <h2>Players ({players.length})</h2>
        <ul>
          {players.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
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
        <h2>Question {currentQuestion.questionIndex + 1}</h2>
        <p>{currentQuestion.question.text}</p>
        {currentQuestion.question.options?.map((opt, i) => (
          <div key={i}>{opt}</div>
        ))}
        <button onClick={revealAnswer}>Reveal Answer</button>
      </div>
    )
  }

  if (gameState === 'revealing') {
    return (
      <div>
        <h2>Scoreboard</h2>
        {scoreboard.map((entry) => (
          <div key={entry.playerId}>
            {entry.rank}. {entry.playerName}: {entry.score}
          </div>
        ))}
        <button onClick={nextQuestion}>Next Question</button>
      </div>
    )
  }

  return (
    <div>
      <h1>Game Over!</h1>
      <button onClick={rematch}>Play Again</button>
    </div>
  )
}
```

### 3. Create the Player Screen

```tsx
// app/play/[code]/page.tsx
import { useQuizPlayer } from 'amalie-engine'

export default function PlayerPage({ params }: { params: { code: string } }) {
  const { gameState, currentQuestion, myScore, myRank, hasAnswered, submitAnswer, isConnected } =
    useQuizPlayer({
      supabaseClient: supabase,
      roomCode: params.code,
      playerName: 'Player Name', // Get from form/auth
    })

  if (!isConnected) {
    return <div>Connecting...</div>
  }

  if (gameState === 'lobby') {
    return <div>Waiting for host to start...</div>
  }

  if (gameState === 'playing' && currentQuestion) {
    return (
      <div>
        <p>{currentQuestion.text}</p>
        {currentQuestion.options?.map((opt, i) => (
          <button key={i} onClick={() => submitAnswer(i)} disabled={hasAnswered}>
            {opt}
          </button>
        ))}
        {hasAnswered && <p>Answer submitted!</p>}
      </div>
    )
  }

  return (
    <div>
      <p>Score: {myScore}</p>
      <p>Rank: {myRank}</p>
    </div>
  )
}
```

## Full Next.js Example

Here's a complete example showing how to set up a quiz app with Next.js App Router.

### Project Structure

```
app/
├── layout.tsx          # Root layout with providers
├── page.tsx            # Home page
├── host/
│   └── page.tsx        # Host screen
├── play/
│   └── [code]/
│       └── page.tsx    # Player screen
└── lib/
    └── supabase.ts     # Supabase client
```

### 1. Supabase Client (`app/lib/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
```

### 2. Root Layout (`app/layout.tsx`)

```tsx
import { QuizProvider } from 'amalie-engine'
import { supabase } from './lib/supabase'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QuizProvider supabaseClient={supabase}>{children}</QuizProvider>
      </body>
    </html>
  )
}
```

### 3. Host Page (`app/host/page.tsx`)

```tsx
'use client'

import { useState } from 'react'
import { useQuizHost, RoomQRCode, type Question } from 'amalie-engine'
import { supabase } from '../lib/supabase'

const questions: Question[] = [
  {
    id: '1',
    category: 'Science',
    text: 'What is the chemical symbol for gold?',
    answerType: 'multiple-choice',
    options: ['Ag', 'Au', 'Fe', 'Cu'],
    correctOptionIndex: 1,
  },
  {
    id: '2',
    category: 'Geography',
    text: 'What is the capital of Japan?',
    answerType: 'text',
    correctText: 'Tokyo',
    acceptedAnswers: ['Tokyo', 'tokyo'],
  },
  {
    id: '3',
    category: 'History',
    text: 'In what year did World War II end?',
    answerType: 'numeric',
    correctNumber: 1945,
    lowerBound: 1900,
    upperBound: 2000,
  },
]

export default function HostPage() {
  const {
    gameState,
    currentQuestion,
    players,
    scoreboard,
    answers,
    allPlayersAnswered,
    roomCode,
    startGame,
    nextQuestion,
    revealAnswer,
    endRound,
    endGame,
    rematch,
    kickPlayer,
    isConnected,
  } = useQuizHost({
    supabaseClient: supabase,
    config: {
      scoring: {
        basePoints: 100,
        timeBonus: { enabled: true, maxBonus: 50, decayPerSecond: 5 },
        streakBonus: { enabled: true, multiplierPerStreak: 0.1, maxMultiplier: 2 },
      },
      questionTimeLimit: 30,
      questionsPerGame: questions.length,
      autoAdvanceOnAllAnswered: false, // Host controls when to reveal
    },
    questions,
    baseUrl: typeof window !== 'undefined' ? `${window.location.origin}/play` : '',
  })

  if (!isConnected) {
    return <div className="p-8">Connecting...</div>
  }

  // Lobby - waiting for players
  if (gameState === 'lobby') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Quiz Lobby</h1>
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
          <p className="text-lg">
            Room Code: <span className="font-mono font-bold">{roomCode}</span>
          </p>
          <RoomQRCode
            roomCode={roomCode}
            baseUrl={typeof window !== 'undefined' ? `${window.location.origin}/play` : ''}
            size={200}
          />
        </div>

        <h2 className="text-xl font-semibold mb-2">Players ({players.length})</h2>
        {players.length === 0 ? (
          <p className="text-gray-500">Waiting for players to join...</p>
        ) : (
          <ul className="space-y-2 mb-6">
            {players.map((player) => (
              <li
                key={player.id}
                className="flex justify-between items-center bg-white p-3 rounded shadow"
              >
                <span>{player.name}</span>
                <button onClick={() => kickPlayer(player.id)} className="text-red-500 text-sm">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={startGame}
          disabled={players.length === 0}
          className="w-full bg-blue-500 text-white py-3 rounded-lg disabled:opacity-50"
        >
          Start Game ({questions.length} questions)
        </button>
      </div>
    )
  }

  // Playing - showing question
  if (gameState === 'playing' && currentQuestion) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex justify-between mb-4">
          <span>
            Question {currentQuestion.questionIndex + 1} of {currentQuestion.totalQuestions}
          </span>
          <span>
            {answers.length} / {players.length} answered
          </span>
        </div>

        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <p className="text-sm text-gray-500 mb-2">{currentQuestion.question.category}</p>
          <h2 className="text-2xl font-bold mb-4">{currentQuestion.question.text}</h2>

          {currentQuestion.question.options && (
            <div className="grid grid-cols-2 gap-3">
              {currentQuestion.question.options.map((option, i) => (
                <div key={i} className="bg-gray-100 p-3 rounded">
                  {option}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {allPlayersAnswered ? (
            <button
              onClick={revealAnswer}
              className="flex-1 bg-green-500 text-white py-3 rounded-lg"
            >
              All Answered - Reveal!
            </button>
          ) : (
            <button onClick={endRound} className="flex-1 bg-yellow-500 text-white py-3 rounded-lg">
              End Round Early
            </button>
          )}
        </div>
      </div>
    )
  }

  // Revealing - showing answer and scores
  if (gameState === 'revealing') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">Scoreboard</h2>

        <div className="space-y-2 mb-6">
          {scoreboard.map((entry) => (
            <div
              key={entry.playerId}
              className={`flex justify-between p-3 rounded ${
                entry.lastAnswerCorrect ? 'bg-green-100' : 'bg-red-100'
              }`}
            >
              <span>
                {entry.rank}. {entry.playerName}
                {entry.pointsThisRound ? ` (+${entry.pointsThisRound})` : ''}
              </span>
              <span className="font-bold">{entry.score}</span>
            </div>
          ))}
        </div>

        <button onClick={nextQuestion} className="w-full bg-blue-500 text-white py-3 rounded-lg">
          Next Question
        </button>
      </div>
    )
  }

  // Finished - game over
  return (
    <div className="p-8 max-w-2xl mx-auto text-center">
      <h1 className="text-3xl font-bold mb-2">Game Over!</h1>
      <p className="text-xl mb-6">
        Winner: {scoreboard[0]?.playerName} with {scoreboard[0]?.score} points!
      </p>

      <div className="space-y-2 mb-6">
        {scoreboard.map((entry) => (
          <div key={entry.playerId} className="flex justify-between p-3 bg-gray-100 rounded">
            <span>
              {entry.rank}. {entry.playerName}
            </span>
            <span className="font-bold">{entry.score}</span>
          </div>
        ))}
      </div>

      <button onClick={rematch} className="w-full bg-green-500 text-white py-3 rounded-lg">
        Play Again
      </button>
    </div>
  )
}
```

### 4. Player Page (`app/play/[code]/page.tsx`)

```tsx
'use client'

import { useState } from 'react'
import { useQuizPlayer } from 'amalie-engine'
import { supabase } from '../../lib/supabase'

export default function PlayerPage({ params }: { params: { code: string } }) {
  const [name, setName] = useState('')
  const [joined, setJoined] = useState(false)

  // Only initialize hook after name is entered
  if (!joined) {
    return (
      <div className="p-8 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Join Quiz</h1>
        <p className="mb-4">
          Room: <span className="font-mono">{params.code}</span>
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="w-full p-3 border rounded mb-4"
        />
        <button
          onClick={() => name.trim() && setJoined(true)}
          disabled={!name.trim()}
          className="w-full bg-blue-500 text-white py-3 rounded disabled:opacity-50"
        >
          Join Game
        </button>
      </div>
    )
  }

  return <PlayerGame roomCode={params.code} playerName={name} />
}

function PlayerGame({ roomCode, playerName }: { roomCode: string; playerName: string }) {
  const {
    gameState,
    currentQuestion,
    myScore,
    myRank,
    hasAnswered,
    answerRejected,
    questionTimeRemaining,
    submitAnswer,
    isConnected,
    isReconnecting,
  } = useQuizPlayer({
    supabaseClient: supabase,
    roomCode,
    playerName,
  })

  if (!isConnected) {
    return (
      <div className="p-8 text-center">{isReconnecting ? 'Reconnecting...' : 'Connecting...'}</div>
    )
  }

  // Waiting in lobby
  if (gameState === 'lobby') {
    return (
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Welcome, {playerName}!</h1>
        <p className="text-gray-500">Waiting for the host to start the game...</p>
      </div>
    )
  }

  // Playing - answer the question
  if (gameState === 'playing' && currentQuestion) {
    const timeLeft = questionTimeRemaining ? Math.ceil(questionTimeRemaining / 1000) : null

    return (
      <div className="p-8 max-w-md mx-auto">
        {timeLeft !== null && (
          <div className="text-center mb-4">
            <span className={`text-2xl font-bold ${timeLeft <= 5 ? 'text-red-500' : ''}`}>
              {timeLeft}s
            </span>
          </div>
        )}

        <p className="text-sm text-gray-500 mb-2">{currentQuestion.category}</p>
        <h2 className="text-xl font-bold mb-6">{currentQuestion.text}</h2>

        {hasAnswered ? (
          <div className="text-center p-6 bg-green-100 rounded-lg">
            <p className="text-green-700 font-semibold">Answer submitted!</p>
            <p className="text-sm text-gray-500">Waiting for other players...</p>
          </div>
        ) : answerRejected ? (
          <div className="text-center p-6 bg-red-100 rounded-lg">
            <p className="text-red-700">Too late! Time's up.</p>
          </div>
        ) : (
          <>
            {currentQuestion.answerType === 'multiple-choice' && currentQuestion.options && (
              <div className="space-y-3">
                {currentQuestion.options.map((option, i) => (
                  <button
                    key={i}
                    onClick={() => submitAnswer(i)}
                    className="w-full p-4 bg-white border-2 rounded-lg hover:border-blue-500 active:bg-blue-50"
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {currentQuestion.answerType === 'text' && <TextAnswerInput onSubmit={submitAnswer} />}

            {currentQuestion.answerType === 'numeric' && (
              <NumericAnswerInput onSubmit={submitAnswer} />
            )}
          </>
        )}
      </div>
    )
  }

  // Revealing or finished - show score
  return (
    <div className="p-8 text-center">
      <h2 className="text-2xl font-bold mb-4">
        {gameState === 'finished' ? 'Game Over!' : 'Round Complete'}
      </h2>
      <div className="bg-gray-100 p-6 rounded-lg">
        <p className="text-4xl font-bold mb-2">{myScore}</p>
        <p className="text-gray-500">Your Score</p>
        <p className="text-lg mt-4">Rank: {myRank}</p>
      </div>
    </div>
  )
}

function TextAnswerInput({ onSubmit }: { onSubmit: (answer: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Type your answer..."
        className="w-full p-3 border rounded mb-3"
      />
      <button
        onClick={() => value.trim() && onSubmit(value.trim())}
        disabled={!value.trim()}
        className="w-full bg-blue-500 text-white py-3 rounded disabled:opacity-50"
      >
        Submit
      </button>
    </div>
  )
}

function NumericAnswerInput({ onSubmit }: { onSubmit: (answer: number) => void }) {
  const [value, setValue] = useState('')
  return (
    <div>
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter a number..."
        className="w-full p-3 border rounded mb-3"
      />
      <button
        onClick={() => value && onSubmit(Number(value))}
        disabled={!value}
        className="w-full bg-blue-500 text-white py-3 rounded disabled:opacity-50"
      >
        Submit
      </button>
    </div>
  )
}
```

### 5. Environment Variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Question Types

### Multiple Choice

```typescript
const question: Question = {
  id: 'mc-1',
  category: 'Geography',
  text: 'What is the capital of France?',
  answerType: 'multiple-choice',
  options: ['London', 'Paris', 'Berlin', 'Madrid'],
  correctOptionIndex: 1,
  difficulty: 'easy',
}
```

### Text Input

```typescript
const question: Question = {
  id: 'text-1',
  category: 'Geography',
  text: 'Name the largest country by area',
  answerType: 'text',
  correctText: 'Russia',
  acceptedAnswers: ['Russia', 'Russian Federation'],
  caseSensitive: false,
}
```

### Numeric/Estimation

```typescript
const question: Question = {
  id: 'est-1',
  category: 'History',
  text: 'In what year did World War II end?',
  answerType: 'numeric',
  correctNumber: 1945,
  lowerBound: 1900,
  upperBound: 2000,
}
```

### With Media

```typescript
const question: Question = {
  id: 'media-1',
  category: 'Music',
  text: 'Name this song',
  answerType: 'text',
  correctText: 'Bohemian Rhapsody',
  media: {
    type: 'audio',
    url: 'https://example.com/song.mp3',
    autoplay: true,
    showDuring: 'question',
  },
}
```

### With Extra Info

```typescript
interface CountryInfo {
  flag: string
  capital: string
  population: number
}

const question: Question<CountryInfo> = {
  id: 'country-1',
  category: 'Geography',
  text: 'Which country has this flag? 🇯🇵',
  answerType: 'text',
  correctText: 'Japan',
  extraInfo: {
    flag: '🇯🇵',
    capital: 'Tokyo',
    population: 125800000,
  },
}
```

## Scoring Configuration

```typescript
const config: QuizGameConfig = {
  scoring: {
    // Base points for correct answer
    basePoints: 100,

    // Time bonus (faster = more points)
    timeBonus: {
      enabled: true,
      maxBonus: 50, // Max bonus at instant answer
      decayPerSecond: 5, // Points lost per second
    },

    // Streak bonus (consecutive correct answers)
    streakBonus: {
      enabled: true,
      multiplierPerStreak: 0.1, // 10% per streak
      maxMultiplier: 2, // Cap at 2x
    },

    // Difficulty multipliers
    difficultyMultipliers: {
      easy: 1,
      medium: 1.5,
      hard: 2,
    },

    // Estimation scoring (golf-style: lower is better)
    estimation: {
      exactMatchBonus: -10, // Bonus for exact answer
      capAtMax: true,
      maxScore: 25, // Worst possible score
      minScore: 1, // Best non-exact score
    },
  },
}
```

## Round Behavior

The game is round-based, where each question is a round. You can configure how rounds end:

```typescript
const config: QuizGameConfig = {
  // Number of rounds (questions) per game
  questionsPerGame: 10,

  // Time limit per round in seconds
  questionTimeLimit: 20,

  // Auto-advance to reveal when all players have answered
  autoAdvanceOnAllAnswered: true,
}
```

### Round Lifecycle

1. **Host calls `nextQuestion()`** - A new round starts
2. **Players submit answers** - The `answers` array updates in real-time
3. **Round ends** when one of:
   - All connected players have answered (if `autoAdvanceOnAllAnswered: true`, auto-reveals)
   - Time runs out
   - Host calls `endRound()` to force-end early
4. **Host calls `revealAnswer()`** (or auto-called) - Shows correct answer and scores
5. Repeat until all rounds complete

### Host Controls

```tsx
const {
  allPlayersAnswered, // true when all connected players have answered
  endRound, // Force end current round (goes to reveal)
  revealAnswer, // Reveal the answer and scores
  // ...
} = useQuizHost(options)

// Show indicator when all have answered
{
  allPlayersAnswered && !autoAdvanceOnAllAnswered && (
    <button onClick={revealAnswer}>All players answered - Reveal!</button>
  )
}

// Allow host to end round early (e.g., if a player disconnected)
;<button onClick={endRound}>End Round Early</button>
```

## Power-ups

Built-in power-ups:

```typescript
import {
  DOUBLE_POINTS, // 2x points for next question
  FIFTY_FIFTY, // Remove two wrong options
  EXTRA_TIME, // Get extra seconds
  SKIP_QUESTION, // Skip without penalty
  SHIELD, // Protect streak on wrong answer
  STEAL_POINTS, // Steal from leader
} from 'amalie-engine'

const config: QuizGameConfig = {
  powerups: [DOUBLE_POINTS, FIFTY_FIFTY, SHIELD],
  // ...
}
```

## Question Providers

### From Array

```typescript
import { createArrayProvider } from 'amalie-engine'

const provider = createArrayProvider(questions)
const filtered = await provider.getQuestions({
  categories: ['Science', 'History'],
  count: 10,
  shuffle: true,
})
```

### From JSON URL

```typescript
import { createJsonUrlProvider } from 'amalie-engine'

const provider = createJsonUrlProvider('https://api.example.com/questions.json')
const questions = await provider.getQuestions()
```

### From Supabase

```typescript
import { createSupabaseProvider } from 'amalie-engine'

const provider = createSupabaseProvider(supabaseClient, {
  tableName: 'quiz_questions',
  categoryColumn: 'category',
})
const questions = await provider.getQuestions({
  categories: ['Science'],
  difficulties: ['easy', 'medium'],
})
```

## API Reference

### Hooks

#### `useQuizHost(options)`

Host-side hook for managing a quiz game.

**Options:**

- `supabaseClient` - Supabase client instance
- `config` - Game configuration
- `questions` - Array of questions or QuestionProvider
- `baseUrl` - Base URL for join links
- `onGameEnd` - Callback when game ends
- `onRematch` - Callback before rematch

**Returns:**

- `gameState` - Current game phase
- `currentQuestion` - Current question state
- `players` - List of players
- `scoreboard` - Current scoreboard
- `answers` - Current round's answers
- `allPlayersAnswered` - Whether all connected players have answered
- `roomCode` - Room code
- `joinUrl` - Full join URL
- `startGame()` - Start the game
- `nextQuestion()` - Show next question
- `revealAnswer()` - Reveal the answer
- `endRound()` - Force end current round (goes to reveal)
- `endGame()` - End the game
- `rematch()` - Start a rematch
- `kickPlayer(id)` - Remove a player
- `adjustScore(id, points)` - Adjust player score
- ...and more

#### `useQuizPlayer(options)`

Player-side hook for playing in a quiz game.

**Options:**

- `supabaseClient` - Supabase client instance
- `roomCode` - Room code to join
- `playerName` - Player's display name

**Returns:**

- `gameState` - Current game phase
- `currentQuestion` - Current question (without answers)
- `myScore` - Player's current score
- `myRank` - Player's current rank
- `hasAnswered` - Whether player has answered
- `submitAnswer(answer)` - Submit an answer
- `activatePowerup(id)` - Use a power-up
- `isConnected` - Connection status
- `reconnect()` - Reconnect to game
- ...and more

### Components

#### `<RoomQRCode />`

QR code component for player joining.

```tsx
<RoomQRCode
  roomCode="ABC123"
  baseUrl="https://myquiz.com/play"
  size={256}
  bgColor="#ffffff"
  fgColor="#000000"
/>
```

## License

MIT
