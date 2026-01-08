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
// Main hooks
import { useQuizHost, useQuizPlayer, useScoreboard, QuizProvider } from 'amalie-engine'

// Question providers
import { JsonArrayProvider, JsonUrlProvider, SupabaseQuestionProvider } from 'amalie-engine'

// Types
import type { Question, QuizGameConfig, Player, GameState } from 'amalie-engine'

// Utilities
import { generateRoomCode, createJoinUrl } from 'amalie-engine'

// Components (optional - requires qrcode.react)
import { RoomQRCode } from 'amalie-engine/components'
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        HOST DEVICE                           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              useQuizHost Hook                        │    │
│  │  - Manages game state machine                        │    │
│  │  - Loads questions from provider                     │    │
│  │  - Calculates scores                                 │    │
│  │  - Broadcasts state to players                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Supabase Realtime
                              │ (Broadcast + Presence)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      PLAYER DEVICES                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              useQuizPlayer Hook                      │    │
│  │  - Receives game state from host                     │    │
│  │  - Submits answers                                   │    │
│  │  - Manages player identity                           │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Required Setup

### 1. Supabase Project

The game requires a Supabase project with Realtime enabled. No database tables are required for basic functionality.

```typescript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### 2. QuizProvider Wrapper

Wrap the app (or relevant pages) with QuizProvider:

```tsx
import { QuizProvider } from 'amalie-engine'
import { supabase } from '@/lib/supabase'

export default function Layout({ children }) {
  return (
    <QuizProvider supabase={supabase}>
      {children}
    </QuizProvider>
  )
}
```

## Question Types

The engine supports 5 question types:

| Type | Description | Answer Format |
|------|-------------|---------------|
| `multiple-choice` | Standard A/B/C/D options | `correctAnswer: "Paris"` + `options: [...]` |
| `text` | Free-form text input | `correctAnswer: "blue"` or `aliases: ["blue", "azure"]` |
| `estimation` | Numeric guess (closest wins) | `correctAnswer: 1969` (number) |
| `ordered` | Arrange items in order | `correctAnswer: ["First", "Second", "Third"]` |
| `image` | Image-based question | Same as others + `imageUrl: "..."` |

### Question Structure

```typescript
interface Question {
  id: string
  type: 'multiple-choice' | 'text' | 'estimation' | 'ordered' | 'image'
  question: string
  correctAnswer: string | number | string[]
  options?: string[]           // Required for multiple-choice
  aliases?: string[]           // Alternative correct answers for text
  imageUrl?: string            // For image questions
  timeLimit?: number           // Override default (seconds)
  points?: number              // Override default points
  difficulty?: 'easy' | 'medium' | 'hard'
  explanation?: string         // Shown after reveal
  category?: string
}
```

## Host Page Implementation

```tsx
'use client'

import { useQuizHost, JsonArrayProvider } from 'amalie-engine'

const questions = [
  {
    id: '1',
    type: 'multiple-choice' as const,
    question: 'What is the capital of France?',
    correctAnswer: 'Paris',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
  },
  // ... more questions
]

export default function HostPage() {
  const {
    // State
    gameState,
    players,
    currentQuestion,
    timeRemaining,
    scoreboard,
    allPlayersAnswered,
    
    // Actions
    startGame,
    revealAnswer,
    nextQuestion,
    endRound,
    rematch,
    
    // Setup
    roomCode,
    joinUrl,
    isConnected,
  } = useQuizHost({
    questionProvider: new JsonArrayProvider(questions),
    baseUrl: typeof window !== 'undefined' ? window.location.origin : '',
    playerPath: '/play',
    scoring: {
      basePoints: 1000,
      timeBonus: { enabled: true, maxBonus: 500 },
      streakBonus: { enabled: true, multiplier: 0.1 },
    },
    timeLimit: 30,
    autoAdvanceOnAllAnswered: false, // Set true to auto-reveal when everyone answers
  })

  // Render based on gameState: 'lobby' | 'playing' | 'revealing' | 'finished'
}
```

## Player Page Implementation

```tsx
'use client'

import { useQuizPlayer } from 'amalie-engine'
import { useSearchParams } from 'next/navigation'

export default function PlayerPage() {
  const searchParams = useSearchParams()
  const roomCode = searchParams.get('room')

  const {
    // State
    gameState,
    currentQuestion,
    myAnswer,
    hasAnswered,
    timeRemaining,
    myScore,
    
    // Actions
    joinGame,
    submitAnswer,
    
    // Connection
    isConnected,
    error,
  } = useQuizPlayer()

  // Join flow: show name input, call joinGame(roomCode, playerName)
  // Game flow: show question, call submitAnswer(answer)
}
```

## Game Flow

```
1. LOBBY
   - Host shows room code / QR code
   - Players join with name
   - Host sees player list
   - Host clicks "Start Game"

2. PLAYING (per question)
   - Question displayed to all
   - Timer counts down
   - Players submit answers
   - Host can "End Round" early OR wait for timer/all answers

3. REVEALING
   - Correct answer shown
   - Points awarded
   - Scoreboard updated
   - Host clicks "Next Question" or game ends

4. FINISHED
   - Final scoreboard
   - Winner announced
   - Host can start "Rematch"
```

## Key Configuration Options

```typescript
interface QuizGameConfig {
  // Questions
  questionProvider: QuestionProvider
  shuffleQuestions?: boolean      // Default: false
  questionsPerGame?: number       // Limit questions (default: all)

  // Timing
  timeLimit?: number              // Seconds per question (default: 30)
  
  // Scoring
  scoring?: {
    basePoints?: number           // Default: 1000
    timeBonus?: { enabled: boolean; maxBonus: number }
    streakBonus?: { enabled: boolean; multiplier: number }
    difficultyMultipliers?: { easy: number; medium: number; hard: number }
  }

  // Behavior
  autoAdvanceOnAllAnswered?: boolean  // Auto-reveal when all answer
  answerMode?: 'all-players' | 'first-to-answer'

  // URLs
  baseUrl: string                 // For generating join links
  playerPath?: string             // Default: '/play'
}
```

## Common Patterns

### Loading Questions from URL

```typescript
const { ... } = useQuizHost({
  questionProvider: new JsonUrlProvider('https://api.example.com/questions'),
  // ...
})
```

### Loading Questions from Supabase

```typescript
import { SupabaseQuestionProvider } from 'amalie-engine'

const { ... } = useQuizHost({
  questionProvider: new SupabaseQuestionProvider(supabase, {
    table: 'questions',
    // Optional filters
    category: 'science',
    difficulty: 'medium',
    limit: 20,
  }),
  // ...
})
```

### Showing QR Code

```tsx
import { RoomQRCode } from 'amalie-engine/components'

<RoomQRCode joinUrl={joinUrl} size={200} />
```

### Custom Scoreboard

```tsx
const { scoreboard } = useQuizHost({ ... })

// scoreboard is sorted array: [{ id, name, score, rank }, ...]
{scoreboard.map((player) => (
  <div key={player.id}>
    #{player.rank} {player.name}: {player.score} pts
  </div>
))}
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
    └── questions.ts    # Question data or provider setup
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
| Players can't join | Check Supabase Realtime is enabled, verify room code |
| Questions don't load | Check QuestionProvider, verify data format |
| Scores not updating | Ensure `revealAnswer()` is called after each question |
| State out of sync | Host is source of truth; players receive via broadcast |

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
