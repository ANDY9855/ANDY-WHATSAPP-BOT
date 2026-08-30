export type QuizQuestion = { question: string; options: string[]; answer: number; sourceAnswer?: string }

type QuizSession = { questions: QuizQuestion[]; current: number; answers: number[]; startedAt: number }

const sessions = new Map<string, QuizSession>()

const fallback: QuizQuestion[] = [
  { question: 'What is the capital of France?', options: ['Madrid', 'Paris', 'Rome', 'Berlin'], answer: 1 },
  { question: 'Which planet is known as the Red Planet?', options: ['Earth', 'Venus', 'Mars', 'Jupiter'], answer: 2 },
  { question: 'How many continents are there?', options: ['5', '6', '7', '8'], answer: 2 },
  { question: 'What is H2O commonly called?', options: ['Salt', 'Water', 'Oxygen', 'Hydrogen'], answer: 1 },
  { question: 'Which language runs in a web browser?', options: ['JavaScript', 'C++', 'SQL', 'Bash'], answer: 0 },
  { question: 'What is 12 × 8?', options: ['86', '96', '108', '112'], answer: 1 },
  { question: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], answer: 3 },
  { question: 'What gas do plants absorb?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], answer: 2 },
  { question: 'Which instrument has keys, pedals, and strings?', options: ['Flute', 'Piano', 'Drum', 'Violin'], answer: 1 },
  { question: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], answer: 1 }
]

function normalizeRemoteQuestion(q: any): QuizQuestion | null {
  const options = Array.isArray(q?.options) ? q.options.map(String).slice(0, 4) : []
  if (!q?.question || options.length !== 4) return null
  const raw = String(q.answer ?? '')
  let answer = options.findIndex((option: string) => option.toLowerCase() === raw.toLowerCase())
  if (answer < 0 && /^\d+$/.test(raw)) answer = Number(raw) - 1
  return answer >= 0 && answer < 4 ? { question: String(q.question), options, answer, sourceAnswer: raw } : null
}

export function buildQuestions(remote: any): QuizQuestion[] {
  const remoteQuestions = Array.isArray(remote?.questions) ? remote.questions.map(normalizeRemoteQuestion).filter(Boolean) as QuizQuestion[] : []
  const combined = [...remoteQuestions, ...fallback]
  return combined.slice(0, 10)
}

export function beginQuiz(jid: string, remote: any) {
  const session: QuizSession = { questions: buildQuestions(remote), current: 0, answers: [], startedAt: Date.now() }
  sessions.set(jid, session)
  return questionText(session)
}

export function hasQuiz(jid: string) { return sessions.has(jid) }

export function parseOption(text: string): number | null {
  const value = text.trim().toLowerCase().replace(/^\.option[- ]?/, '')
  if (!/^[1-4]$/.test(value)) return null
  return Number(value) - 1
}

export function answerQuiz(jid: string, option: number) {
  const session = sessions.get(jid)
  if (!session) return { kind: 'none' as const }
  const question = session.questions[session.current]
  session.answers.push(option)
  session.current++
  if (session.current < session.questions.length) return { kind: 'next' as const, text: questionText(session), correct: option === question.answer }
  sessions.delete(jid)
  return { kind: 'complete' as const, text: reportText(session), correct: option === question.answer }
}

function questionText(session: QuizSession) {
  const q = session.questions[session.current]
  return `*🤖 BOT_404 QUIZ*\n\n*Question ${session.current + 1}/${session.questions.length}*\n${q.question}\n\n${q.options.map((option, i) => `*${i + 1}.* ${option}`).join('\n')}\n\n*Reply with:* .option-1, .option-2, .option-3, or .option-4\nYou can also reply with just *1*, *2*, *3*, or *4*.`
}

function reportText(session: QuizSession) {
  const score = session.answers.reduce((sum, answer, i) => sum + (answer === session.questions[i].answer ? 1 : 0), 0)
  const total = session.questions.length
  const percent = Math.round((score / total) * 100)
  const grade = percent >= 90 ? 'A+' : percent >= 80 ? 'A' : percent >= 70 ? 'B' : percent >= 60 ? 'C' : percent >= 50 ? 'D' : 'F'
  const rows = session.questions.map((q, i) => {
    const chosen = session.questions[i].options[session.answers[i]] ?? 'No answer'
    const mark = session.answers[i] === q.answer ? '✅' : '❌'
    return `${mark} ${i + 1}. ${chosen} | Correct: ${q.options[q.answer]}`
  }).join('\n')
  return `*🤖 BOT_404 REPORT CARD*\n\n*Quiz complete!*\n\n*Score:* ${score}/${total}\n*Percentage:* ${percent}%\n*Grade:* ${grade}\n\n*Answer Review*\n${rows}\n\nThank you for playing BOT_404 Quiz.`
}
