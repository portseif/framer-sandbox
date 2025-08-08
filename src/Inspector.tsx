import { useEffect, useMemo, useState } from 'react'
import QuizForm from './components/quiz-form/QuizForm'

const defaultProps = {
  title: 'Multi-Step Form',
  subtitle: 'Please fill out all required fields',
  primaryColor: '#A67C8E',
  secondaryColor: '#632240',
  backgroundColor: '#FEFEFE',
  textColor: '#333333',
  buttonTextColor: '#FFFFFF',
  disabledColor: '#CCCCCC',
  borderRadius: 8,
  successMessage: 'Thank you for your submission!',
  errorMessage: 'An error occurred. Please try again.',
  submitButtonText: 'Submit',
  previousButtonText: 'Previous',
  nextButtonText: 'Next',
  showBackButton: true,
  showProgressCount: true,
  submissionActions: [],
  executeInParallel: false,
  fields: [
    {
      id: 'q1',
      question: 'Have you taken antibiotics in the last 3 months?',
      subtext: 'PLEASE SELECT ONE',
      type: 'radio',
      options: ['Yes', 'No'],
      required: true,
      hideNextButton: true,
    },
    {
      id: 'q2',
      question: 'What is your age?',
      type: 'number',
      useSlider: true,
      sliderMin: 0,
      sliderMax: 100,
      sliderValue: 28,
      required: true,
    },
    {
      id: 'q3',
      question: 'Enter your email',
      type: 'email',
      emailSubmission: true,
      emailSubtext: 'We will send a summary to <b>your inbox</b>.',
      emailSubmitButtonText: 'Finish',
      required: true,
    },
  ],
}

export default function Inspector() {
  const [json, setJson] = useState(() => JSON.stringify(defaultProps, null, 2))
  const [parsed, setParsed] = useState<any>(defaultProps)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    try {
      const next = JSON.parse(json)
      setParsed(next)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Invalid JSON')
    }
  }, [json])

  const sideStyle: React.CSSProperties = useMemo(
    () => ({
      width: 360,
      borderRight: '1px solid #eee',
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }),
    []
  )

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <aside style={sideStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <strong>Inspector</strong>
          <button onClick={() => setJson(JSON.stringify(defaultProps, null, 2))} style={{ padding: '6px 10px' }}>
            Reset
          </button>
        </div>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
          style={{ flex: 1, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, width: '100%', resize: 'none' }}
        />
        {error && <div style={{ color: '#b00020', fontSize: 12 }}>JSON error: {error}</div>}
      </aside>
      <main style={{ flex: 1, minWidth: 0 }}>
        <QuizForm {...parsed} />
      </main>
    </div>
  )
}
