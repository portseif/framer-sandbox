import {
    useState,
    useCallback,
    startTransition,
    useEffect,
    useMemo,
    useRef,
} from "react"
import { addPropertyControls, ControlType } from "framer"

// ===================================================================
// GLOBAL TYPE DECLARATIONS FOR GTM
// ===================================================================

declare global {
    interface Window {
        dataLayer: any[]
        formStartTime?: number
    }
}

// Small utility to send GTM events consistently
function pushGTM(event: string, payload: Record<string, any> = {}): void {
    if (typeof window === "undefined") return
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({ event, timestamp: new Date().toISOString(), ...payload })
}

// ===================================================================
// SAFE EXTERNAL COMPONENT IMPORTS WITH FALLBACKS
// ===================================================================

let AgeSelector: any, WeGotYou: any

try {
    // Try to import external components
    const AgeSelectorModule = await import(
        "https://framer.com/m/AgeSelector-kxBn.js@V8ogLZAqMz7RsffM3Uhz"
    )
    AgeSelector = AgeSelectorModule.default
} catch (error) {
    console.warn("⚠️ Failed to load AgeSelector, using fallback:", error)
    AgeSelector = null
}

try {
    const WeGotYouModule = await import(
        "https://framer.com/m/WeGotYou-Mvv5.js@HpFMsfuTSHO7FUm10XGi"
    )
    WeGotYou = WeGotYouModule.default
} catch (error) {
    console.warn("⚠️ Failed to load WeGotYou, using fallback:", error)
    WeGotYou = null
}

// ===================================================================
// FALLBACK COMPONENTS
// ===================================================================

const FallbackAgeSelector = ({
    value = 25,
    minAge = 0,
    maxAge = 120,
    onChange,
    width = 358,
    height = 178,
    ...props
}: {
    value?: number
    minAge?: number
    maxAge?: number
    onChange?: (age: number) => void
    width?: number
    height?: number
} & Record<string, any>) => {
    console.log("🚨 Using AgeSelector fallback")
    const [currentValue, setCurrentValue] = useState(value)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value)
        setCurrentValue(newValue)
        onChange?.(newValue)
    }

    return (
        <div
            style={{
                width: width,
                height: height,
                padding: "20px",
                border: "2px dashed #A67C8E",
                borderRadius: "8px",
                textAlign: "center",
                backgroundColor: "#f9f9f9",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: "15px",
            }}
        >
            <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
                Age Selector (Fallback)
            </p>
            <input
                type="range"
                min={minAge}
                max={maxAge}
                value={currentValue}
                onChange={handleChange}
                style={{ width: "80%" }}
            />
            <div
                style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#632240",
                }}
            >
                {currentValue} years
            </div>
        </div>
    )
}

const FallbackWeGotYou = ({ onNext, isMobile, ...props }: { onNext?: () => void; isMobile?: boolean } & Record<string, any>) => {
    console.log("🚨 Using WeGotYou fallback")
    return (
        <div
            style={{
                padding: "40px",
                textAlign: "center",
                border: "2px dashed #A67C8E",
                borderRadius: "8px",
                backgroundColor: "#f9f9f9",
                maxWidth: "400px",
                margin: "0 auto",
            }}
        >
            <h2 style={{ color: "#632240", marginBottom: "20px" }}>
                WeGotYou Fallback Content
            </h2>
            <p style={{ color: "#666", marginBottom: "30px" }}>
                This is a fallback component. The original WeGotYou component
                couldn't be loaded.
            </p>
            <button
                onClick={() => onNext && onNext()}
                style={{
                    padding: "12px 24px",
                    backgroundColor: "#A67C8E",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "500",
                }}
            >
                Continue
            </button>
        </div>
    )
}

// ===================================================================
// SAFE COMPONENT REGISTRY
// ===================================================================

const CustomContentComponents: Record<string, any> = {
    WeGotYou: WeGotYou || FallbackWeGotYou,
}

// ===================================================================
// SUBMISSION ACTION TYPES
// ===================================================================

interface SubmissionAction {
    id: string
    name: string
    type:
        | "webhook"
        | "email"
        | "airtable"
        | "google_sheets"
        | "slack"
        | "custom"
    enabled: boolean
    order: number

    // Common fields
    endpoint?: string
    apiKey?: string

    // Webhook specific
    method?: "POST" | "PUT" | "PATCH"
    headers?: string // JSON string

    // Email specific
    emailTo?: string
    emailSubject?: string
    emailTemplate?: string

    // Airtable specific
    baseId?: string
    tableId?: string

    // Slack specific
    channel?: string
    username?: string

    // Conditional execution
    condition?: string // JS expression like "formData.email.includes('@company.com')"
    onSuccess?: "continue" | "stop"
    onError?: "continue" | "stop" | "retry"
    retryAttempts?: number

    // Data transformation
    dataMapping?: string // JSON string for field mapping
    includeMetadata?: boolean
}

interface FormSubmissionConfig {
    actions: SubmissionAction[]
    executeInParallel?: boolean
    includeAnalytics?: boolean
    onAllSuccess?: string // Redirect URL or action
    onAnyFailure?: string // Fallback action
}

// ===================================================================
// ENHANCED SUBMISSION SERVICE
// ===================================================================

class MultiActionSubmissionService {
    private config: FormSubmissionConfig
    private analytics: Map<string, any> = new Map()

    constructor(config: FormSubmissionConfig) {
        this.config = config
        console.log(
            "🚀 MultiActionSubmissionService initialized with config:",
            config
        )
    }

    async executeActions(
        formData: Record<string, any>,
        navigationPath: string[]
    ): Promise<{
        success: boolean
        results: Array<{
            action: string
            success: boolean
            data?: any
            error?: string
        }>
        summary: { successful: number; failed: number; skipped: number }
    }> {
        console.log("🚀 Executing submission actions...")

        const submissionData = {
            formData,
            navigationPath,
            timestamp: new Date().toISOString(),
            sessionId: this.generateSessionId(),
            ...(this.config.includeAnalytics && {
                analytics: Array.from(this.analytics.values()),
            }),
        }

        console.log("📊 Submission data prepared:", submissionData)

        // Sort actions by order
        const enabledActions = this.config.actions
            .filter((action) => action.enabled)
            .sort((a, b) => a.order - b.order)
            .filter((action) =>
                this.evaluateCondition(action.condition, formData)
            )

        console.log(`✅ ${enabledActions.length} actions ready for execution`)

        const results: Array<{
            action: string
            success: boolean
            data?: any
            error?: string
        }> = []
        let summary = { successful: 0, failed: 0, skipped: 0 }

        if (this.config.executeInParallel) {
            console.log("🔄 Executing actions in parallel...")
            // Execute all actions in parallel
            const promises = enabledActions.map((action) =>
                this.executeAction(action, submissionData)
                    .then((result) => ({
                        action: action.name,
                        success: true,
                        data: result,
                    }))
                    .catch((error) => ({
                        action: action.name,
                        success: false,
                        error: error.message,
                    }))
            )

            const parallelResults = await Promise.all(promises)
            results.push(...parallelResults)

            summary.successful = parallelResults.filter((r) => r.success).length
            summary.failed = parallelResults.filter((r) => !r.success).length
        } else {
            console.log("🔄 Executing actions sequentially...")
            // Execute actions sequentially
            for (const action of enabledActions) {
                try {
                    console.log(`🔄 Executing action: ${action.name}`)
                    const result = await this.executeActionWithRetry(
                        action,
                        submissionData
                    )
                    results.push({
                        action: action.name,
                        success: true,
                        data: result,
                    })
                    summary.successful++

                    console.log(
                        `✅ Action ${action.name} completed successfully`
                    )

                    // Check if we should stop on success
                    if (action.onSuccess === "stop") {
                        console.log(
                            `🛑 Stopping execution due to onSuccess: stop`
                        )
                        break
                    }
                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : "Unknown error"
                    console.error(
                        `❌ Action ${action.name} failed:`,
                        errorMessage
                    )
                    results.push({
                        action: action.name,
                        success: false,
                        error: errorMessage,
                    })
                    summary.failed++

                    // Check if we should stop on error
                    if (action.onError === "stop") {
                        console.log(
                            `🛑 Stopping execution due to onError: stop`
                        )
                        break
                    }
                }
            }
        }

        const overallSuccess = summary.failed === 0 && summary.successful > 0

        console.log(
            `🏁 Submission completed. Success: ${overallSuccess}`,
            summary
        )

        return {
            success: overallSuccess,
            results,
            summary,
        }
    }

    private async executeActionWithRetry(
        action: SubmissionAction,
        data: any,
        attempt: number = 1
    ): Promise<any> {
        try {
            return await this.executeAction(action, data)
        } catch (error) {
            const maxAttempts = action.retryAttempts || 1

            if (attempt < maxAttempts && action.onError === "retry") {
                console.log(
                    `🔄 Retrying action ${action.name}, attempt ${attempt + 1}/${maxAttempts}`
                )
                // Exponential backoff
                await new Promise((resolve) =>
                    setTimeout(resolve, Math.pow(2, attempt) * 1000)
                )
                return this.executeActionWithRetry(action, data, attempt + 1)
            }

            throw error
        }
    }

    private async executeAction(
        action: SubmissionAction,
        data: any
    ): Promise<any> {
        // Transform data if mapping is provided
        const transformedData = this.transformData(data, action.dataMapping)

        // Add metadata if enabled
        const finalData = action.includeMetadata
            ? { ...transformedData, _metadata: this.getMetadata(action) }
            : transformedData

        switch (action.type) {
            case "webhook":
                return this.executeWebhookAction(action, finalData)
            case "email":
                return this.executeEmailAction(action, finalData)
            case "airtable":
                return this.executeAirtableAction(action, finalData)
            case "google_sheets":
                return this.executeGoogleSheetsAction(action, finalData)
            case "slack":
                return this.executeSlackAction(action, finalData)
            case "custom":
                return this.executeCustomAction(action, finalData)
            default:
                throw new Error(`Unknown action type: ${action.type}`)
        }
    }

    private async executeWebhookAction(
        action: SubmissionAction,
        data: any
    ): Promise<any> {
        if (!action.endpoint) throw new Error("Webhook endpoint not configured")

        let headers: Record<string, string> = {
            "Content-Type": "application/json",
        }

        if (action.headers) {
            try {
                headers = { ...headers, ...JSON.parse(action.headers) }
            } catch (e) {
                console.warn("Invalid headers JSON for action:", action.name)
            }
        }

        if (action.apiKey) {
            headers["Authorization"] = `Bearer ${action.apiKey}`
        }

        const response = await fetch(action.endpoint, {
            method: action.method || "POST",
            headers,
            body: JSON.stringify(data),
        })

        if (!response.ok) {
            throw new Error(
                `Webhook failed: ${response.status} ${response.statusText}`
            )
        }

        return response.json()
    }

    private async executeEmailAction(
        action: SubmissionAction,
        data: any
    ): Promise<any> {
        // Example implementation for EmailJS
        const emailData = {
            to_email: action.emailTo,
            subject: action.emailSubject || "Form Submission",
            message: this.formatDataForEmail(data),
            template_id: action.emailTemplate || "default",
        }

        // This would integrate with your preferred email service
        console.log("📧 Sending email with data:", emailData)
        return { sent: true, messageId: `email_${Date.now()}` }
    }

    private async executeAirtableAction(
        action: SubmissionAction,
        data: any
    ): Promise<any> {
        if (!action.endpoint || !action.apiKey) {
            throw new Error("Airtable configuration incomplete")
        }

        const airtableData = {
            records: [
                {
                    fields: this.flattenDataForAirtable(data),
                },
            ],
        }

        const response = await fetch(action.endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${action.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(airtableData),
        })

        if (!response.ok) {
            throw new Error(
                `Airtable submission failed: ${response.statusText}`
            )
        }

        return response.json()
    }

    private async executeGoogleSheetsAction(
        action: SubmissionAction,
        data: any
    ): Promise<any> {
        if (!action.endpoint)
            throw new Error("Google Sheets endpoint not configured")

        const sheetData = {
            values: [Object.values(this.flattenDataForSheets(data))],
        }

        const response = await fetch(action.endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(action.apiKey && {
                    Authorization: `Bearer ${action.apiKey}`,
                }),
            },
            body: JSON.stringify(sheetData),
        })

        if (!response.ok) {
            throw new Error(
                `Google Sheets submission failed: ${response.statusText}`
            )
        }

        return response.json()
    }

    private async executeSlackAction(
        action: SubmissionAction,
        data: any
    ): Promise<any> {
        if (!action.endpoint)
            throw new Error("Slack webhook URL not configured")

        const slackMessage = {
            channel: action.channel,
            username: action.username || "Form Bot",
            text: this.formatDataForSlack(data),
            attachments: [
                {
                    color: "good",
                    fields: Object.entries(data.formData || {}).map(
                        ([key, value]) => ({
                            title: key,
                            value: Array.isArray(value)
                                ? value.join(", ")
                                : String(value),
                            short: true,
                        })
                    ),
                },
            ],
        }

        const response = await fetch(action.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(slackMessage),
        })

        if (!response.ok) {
            throw new Error(`Slack notification failed: ${response.statusText}`)
        }

        return { sent: true }
    }

    private async executeCustomAction(
        action: SubmissionAction,
        data: any
    ): Promise<any> {
        // Allow custom JavaScript execution (be careful with security)
        if (action.endpoint) {
            // Treat as custom webhook
            return this.executeWebhookAction(action, data)
        }

        // Custom processing logic could go here
        console.log("🔧 Custom action executed:", action.name, data)
        return { processed: true }
    }

    private evaluateCondition(
        condition: string | undefined,
        formData: Record<string, any>
    ): boolean {
        if (!condition || condition.trim() === "") return true

        try {
            // Simple condition evaluation (enhance as needed)
            // Example: "formData.email.includes('@company.com')"
            const func = new Function("formData", `return ${condition}`)
            return Boolean(func(formData))
        } catch (error) {
            console.warn("⚠️ Invalid condition expression:", condition, error)
            return true // Default to true on error
        }
    }

    private transformData(data: any, mapping: string | undefined): any {
        if (!mapping || mapping.trim() === "") return data

        try {
            const mappingObj = JSON.parse(mapping)
            const transformed: any = {}

            Object.entries(mappingObj).forEach(([outputKey, inputPath]) => {
                // Simple dot notation support
                const value = this.getNestedValue(data, inputPath as string)
                if (value !== undefined) {
                    transformed[outputKey] = value
                }
            })

            return Object.keys(transformed).length > 0 ? transformed : data
        } catch (error) {
            console.warn("⚠️ Invalid data mapping JSON:", mapping, error)
            return data
        }
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split(".").reduce((current, key) => current?.[key], obj)
    }

    private getMetadata(action: SubmissionAction): any {
        return {
            actionId: action.id,
            actionName: action.name,
            actionType: action.type,
            executedAt: new Date().toISOString(),
            userAgent: typeof window !== "undefined" ? navigator.userAgent : "",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }
    }

    private formatDataForEmail(data: any): string {
        let message = "New form submission:\n\n"

        if (data.formData) {
            Object.entries(data.formData).forEach(([key, value]) => {
                message += `${key}: ${Array.isArray(value) ? value.join(", ") : value}\n`
            })
        }

        return message
    }

    private formatDataForSlack(data: any): string {
        return `New form submission received with ${Object.keys(data.formData || {}).length} fields`
    }

    private flattenDataForAirtable(data: any): Record<string, any> {
        const flattened: Record<string, any> = {
            "Submitted At": data.timestamp,
            "Session ID": data.sessionId,
            "Completion Time": data.completionTime,
        }

        if (data.formData) {
            Object.entries(data.formData).forEach(([key, value]) => {
                flattened[key] = Array.isArray(value) ? value.join(", ") : value
            })
        }

        return flattened
    }

    private flattenDataForSheets(data: any): Record<string, any> {
        return this.flattenDataForAirtable(data) // Same format for now
    }

    private generateSessionId(): string {
        return `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
}

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

interface ProgressStep {
    id: string
    label: string
    completed?: boolean
    active?: boolean
}

interface FormPage {
    id: string
    question: string
    subtext?: string
    type:
        | "text"
        | "email"
        | "number"
        | "select"
        | "radio"
        | "checkbox"
        | "textarea"
        | "progress process"
        | "content"
    // Email options
    emailTitle?: string
    emailSubtext?: string
    emailSubmission?: boolean
    emailSubmitButtonText?: string
    options?: string[]
    required?: boolean
    placeholder?: string
    hideNextButton?: boolean
    conditionalNext?: {
        [answer: string]: string // answer value -> next field ID
    }
    defaultNext?: string
    // Progress process specific properties
    progressTitle?: string
    progressSteps?: ProgressStep[]
    progressBarBgColor?: string
    progressBarValueColor?: string
    logoSvg?: string
    autoAdvanceDelay?: number
    // Number slider properties
    useSlider?: boolean
    sliderValue?: number
    sliderMin?: number
    sliderMax?: number
    sliderShowValue?: boolean
    // Content-specific properties
    contentComponentKey?: string // Key to lookup in CustomContentComponents
    // Per-page header controls
    hideBackButton?: boolean
    hideProgressCount?: boolean
    includeInGtmEvent?: boolean
}

interface FramerFormPage {
    id: string
    question: string
    subtext?: string
    type:
        | "text"
        | "email"
        | "number"
        | "select"
        | "radio"
        | "checkbox"
        | "textarea"
        | "progress process"
        | "content"
    options?: string[]
    required?: boolean
    placeholder?: string
    hideNextButton?: boolean
    includeInGtmEvent?: boolean
    // Framer-specific conditional logic controls
    useConditionalLogic?: boolean
    conditionalRules?: string // "Yes:q4,No:q3"
    defaultNext?: string
    // Email options
    emailTitle?: string
    emailSubtext?: string
    emailSubmission?: boolean
    emailSubmitButtonText?: string
    // Number slider properties
    useSlider?: boolean
    sliderValue?: number
    sliderMin?: number
    sliderMax?: number
    sliderShowValue?: boolean
    // Content-specific properties
    contentComponentKey?: string // Which component to use from CustomContentComponents
    // Progress process specific properties
    progressTitle?: string
    progressSteps?: ProgressStep[]
    progressBarBgColor?: string
    progressBarValueColor?: string
    logoSvg?: string
    autoAdvanceDelay?: number
    // Per-page header controls
    hideBackButton?: boolean
    hideProgressCount?: boolean
}

interface QuizFormProps {
    title: string
    subtitle: string
    fields: FormPage[]
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    textColor: string
    buttonTextColor: string
    disabledColor: string
    borderRadius: number
    successMessage: string
    errorMessage: string
    submitButtonText: string
    previousButtonText: string
    nextButtonText: string
    showBackButton: boolean
    showProgressCount: boolean
    style?: React.CSSProperties
    submissionActions?: SubmissionAction[]
    executeInParallel?: boolean
    onSubmissionSuccess?: (results: any) => void
    onSubmissionError?: (error: string) => void
}

interface FormHeaderProps {
    currentStep: number
    totalSteps: number
    showBackButton: boolean
    showProgressCount: boolean
    onBack: () => void
    textColor: string
    disabledColor: string
    canGoBack?: boolean
    currentField?: FormPage // Add this prop
}

interface ProgressBarProps {
    currentStep: number
    totalSteps: number
    primaryColor: string
}

interface FormPageProps {
    field: FormPage
    value: any
    onChange: (fieldId: string, value: any, isUserInteraction?: boolean) => void
    onCheckboxToggle: (
        fieldId: string,
        option: string,
        isUserInteraction?: boolean
    ) => void
    onNext: (overrideValue?: any) => void
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    textColor: string
    borderRadius: number
    hideNextButton: boolean
    triggerAutoAdvance?: (fieldId: string, value: any, field: FormPage) => void
    onSubmit: () => void
}

interface ContentPageProps {
    field: FormPage
    onNext: (overrideValue?: any) => void
    primaryColor: string
    secondaryColor: string
    backgroundColor: string
    textColor: string
    buttonTextColor: string
}

interface FormButtonProps {
    isLastStep: boolean
    isSubmitting: boolean
    onNext: (overrideValue?: any) => void
    onSubmit: () => void
    primaryColor: string
    buttonTextColor: string
    submitButtonText: string
    nextButtonText: string
    borderRadius: string
    children?: React.ReactNode
}

// ===================================================================
// CONDITIONAL LOGIC HELPERS
// ===================================================================

const findFieldById = (
    fields: FormPage[],
    fieldId: string
): FormPage | undefined => {
    const found = fields.find((field) => field.id === fieldId)
    if (!found) {
        console.warn(`⚠️ Field not found with ID: ${fieldId}`)
    }
    return found
}

const getFieldIndex = (fields: FormPage[], fieldId: string): number => {
    const index = fields.findIndex((field) => field.id === fieldId)
    if (index === -1) {
        console.warn(`⚠️ Field index not found for ID: ${fieldId}`)
    }
    return index
}

const evaluateConditionalNext = (
    currentField: FormPage,
    fieldValue: any,
    fields: FormPage[]
): string | null => {
    // If no conditional logic, return null (use default linear flow)
    if (!currentField.conditionalNext) {
        return null
    }

    console.log("🔀 Evaluating conditional logic:", {
        fieldId: currentField.id,
        fieldValue,
        conditionalNext: currentField.conditionalNext,
    })

    // Handle different field types
    let answerKey: string

    if (currentField.type === "radio" || currentField.type === "select") {
        answerKey = fieldValue?.toString() || ""
    } else if (currentField.type === "checkbox") {
        // For checkboxes, you might want to evaluate based on specific selections
        // This is a simple implementation - you can make it more sophisticated
        answerKey = Array.isArray(fieldValue) ? fieldValue.join(",") : ""
    } else {
        answerKey = fieldValue?.toString() || ""
    }

    console.log("🔀 Answer key for conditional logic:", answerKey)

    // Check if there's a condition for this answer
    const nextFieldId = currentField.conditionalNext[answerKey]

    if (nextFieldId) {
        // Verify the target field exists
        const targetField = findFieldById(fields, nextFieldId)
        if (targetField) {
            console.log("✅ Conditional next field found:", nextFieldId)
            return nextFieldId
        } else {
            console.warn(`⚠️ Conditional next field not found: ${nextFieldId}`)
        }
    }

    // Fall back to defaultNext if specified
    if (currentField.defaultNext) {
        const defaultField = findFieldById(fields, currentField.defaultNext)
        if (defaultField) {
            console.log(
                "✅ Using default next field:",
                currentField.defaultNext
            )
            return currentField.defaultNext
        } else {
            console.warn(
                `⚠️ Default next field not found: ${currentField.defaultNext}`
            )
        }
    }

    // No valid conditional next found
    console.log("ℹ️ No conditional next found, using linear progression")
    return null
}

const getNextFieldId = (
    currentField: FormPage,
    fieldValue: any,
    fields: FormPage[]
): string | null => {
    // First, try conditional logic
    const conditionalNext = evaluateConditionalNext(
        currentField,
        fieldValue,
        fields
    )
    if (conditionalNext) {
        return conditionalNext
    }

    // Fall back to linear progression
    const currentIndex = getFieldIndex(fields, currentField.id)
    if (currentIndex >= 0 && currentIndex < fields.length - 1) {
        const nextField = fields[currentIndex + 1]
        console.log("🔀 Using linear next field:", nextField.id)
        return nextField.id
    }

    console.log("🏁 End of form reached")
    return null // End of form
}

function parseConditionalRules(
    conditionalRules: string
): { [key: string]: string } | undefined {
    if (!conditionalRules || conditionalRules.trim() === "") {
        return undefined
    }

    try {
        const rules: { [key: string]: string } = {}
        const pairs = conditionalRules.split(",")

        pairs.forEach((pair) => {
            const [answer, fieldId] = pair.split(":")
            if (answer && fieldId) {
                rules[answer.trim()] = fieldId.trim()
            }
        })

        const result = Object.keys(rules).length > 0 ? rules : undefined
        console.log("🔀 Parsed conditional rules:", result)
        return result
    } catch (error) {
        console.warn(
            "⚠️ Error parsing conditional rules:",
            conditionalRules,
            error
        )
        return undefined
    }
}

// ===================================================================
// CONVERSION FUNCTION
// ===================================================================

function convertFramerFieldsToFormPages(
    framerFields: FramerFormPage[]
): FormPage[] {
    console.log("🔄 Converting Framer Fields:", framerFields)

    if (!framerFields || framerFields.length === 0) {
        console.warn("⚠️ No framer fields provided, using empty array")
        return []
    }

    const converted = framerFields.map((field, index) => {
        console.log(`🔄 Converting field ${index}:`, field)

        // Validate required field properties
        if (!field.id) {
            console.error(`❌ Field at index ${index} missing ID:`, field)
            field.id = `field-${index}` // Auto-generate ID
        }

        if (!field.type) {
            console.error(`❌ Field ${field.id} missing type:`, field)
            field.type = "text" // Default to text
        }

        // Check for options on fields that need them
        if (
            ["radio", "checkbox", "select"].includes(field.type) &&
            !field.options?.length
        ) {
            console.warn(
                `⚠️ Field ${field.id} of type ${field.type} has no options`
            )
        }

        const formPage: FormPage = {
            id: field.id,
            question:
                field.type === "progress process"
                    ? field.progressTitle || field.question
                    : field.question,
            subtext: field.subtext,
            type: field.type,
            options: field.options,
            required: field.required,
            placeholder: field.placeholder,
            hideNextButton: field.hideNextButton,
            includeInGtmEvent: field.includeInGtmEvent ?? true,
            // Per-page header controls
            hideBackButton: field.hideBackButton,
            hideProgressCount: field.hideProgressCount,
        }

        // Add progress process properties
        if (field.type === "progress process") {
            // Copy all progress-related properties from framer field
            const progressField = field as any // Type assertion for progress fields
            formPage.progressTitle = progressField.progressTitle
            formPage.progressSteps = progressField.progressSteps
            formPage.progressBarBgColor = progressField.progressBarBgColor
            formPage.progressBarValueColor = progressField.progressBarValueColor
            formPage.logoSvg = progressField.logoSvg
            formPage.autoAdvanceDelay = progressField.autoAdvanceDelay
        }

        // Add email properties
        if (field.type === "email") {
            formPage.emailSubmission = field.emailSubmission
            formPage.emailSubmitButtonText = field.emailSubmitButtonText
            formPage.emailSubtext = field.emailSubtext // <-- ensure this is copied
        }

        // Add content properties for content type fields
        if (field.type === "content") {
            formPage.contentComponentKey =
                field.contentComponentKey || "WeGotYou"

            // Validate content component exists
            if (!CustomContentComponents[formPage.contentComponentKey]) {
                console.warn(
                    `⚠️ Content component "${formPage.contentComponentKey}" not found, using WeGotYou`
                )
                formPage.contentComponentKey = "WeGotYou"
            }
        }

        // Add conditional logic if enabled
        if (field.useConditionalLogic) {
            if (field.conditionalRules) {
                formPage.conditionalNext = parseConditionalRules(
                    field.conditionalRules
                )
            }
            if (field.defaultNext) {
                formPage.defaultNext = field.defaultNext
            }
        }

        // Add slider properties if enabled
        if (field.useSlider) {
            formPage.useSlider = true
            formPage.sliderValue = field.sliderValue
            formPage.sliderMin = field.sliderMin
            formPage.sliderMax = field.sliderMax
            formPage.sliderShowValue = field.sliderShowValue
        }

        return formPage
    })

    console.log("✅ Converted fields:", converted)
    return converted
}

// ===================================================================
// CUSTOM HOOKS
// ===================================================================

function useIsMobile(breakpoint: number = 768): boolean {
    const [isMobile, setIsMobile] = useState(
        typeof window !== "undefined" ? window.innerWidth <= breakpoint : false
    )

    useEffect(() => {
        function handleResize() {
            setIsMobile(window.innerWidth <= breakpoint)
        }
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [breakpoint])

    return isMobile
}


// ===================================================================
// ENHANCED FORM LOGIC HOOK
// ===================================================================

const useFormLogic = (
    fields: FormPage[],
    submissionActions: SubmissionAction[],
    executeInParallel: boolean
) => {
    const [currentFieldId, setCurrentFieldId] = useState<string>(
        fields[0]?.id || ""
    )
    const [navigationHistory, setNavigationHistory] = useState<string[]>([
        fields[0]?.id || "",
    ])
    const [formData, setFormData] = useState<Record<string, any>>({})
    const [submitted, setSubmitted] = useState(false)
    const [error, setError] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submissionResult, setSubmissionResult] = useState<any>(null)

    // Track the last user interaction to prevent auto-advance on non-user changes
    const lastUserInteractionRef = useRef<{
        fieldId: string
        timestamp: number
    } | null>(null)
    const navigationTypeRef = useRef<"forward" | "back" | null>(null)
    const backNavigationTimeRef = useRef<number | null>(null)
    const autoAdvanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
        null
    )

    const currentField = findFieldById(fields, currentFieldId)
    const currentStep = getFieldIndex(fields, currentFieldId)

    // Initialize with first field if current field is invalid
    useEffect(() => {
        if (!currentField && fields.length > 0) {
            console.warn(
                `⚠️ Current field ${currentFieldId} not found, resetting to first field`
            )
            setCurrentFieldId(fields[0].id)
            setNavigationHistory([fields[0].id])
        }
    }, [currentField, currentFieldId, fields])

    // Track form start time on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            window.formStartTime = Date.now()
            pushGTM("form_start", {
                formName: "quiz_form",
                totalFields: fields.length,
                startTime: new Date().toISOString(),
            })
        }

        return () => {
            if (typeof window !== "undefined") {
                delete window.formStartTime
            }
        }
    }, [fields.length])

    const handleInputChange = useCallback(
        (fieldId: string, value: any, isUserInteraction: boolean = false) => {
            console.log("📝 Input change:", {
                fieldId,
                value,
                isUserInteraction,
            })

            startTransition(() => {
                setFormData((prev) => ({
                    ...prev,
                    [fieldId]: value,
                }))

                // Track user interaction
                if (isUserInteraction) {
                    lastUserInteractionRef.current = {
                        fieldId,
                        timestamp: Date.now(),
                    }
                    navigationTypeRef.current = null // Clear navigation type on user interaction
                    backNavigationTimeRef.current = null // Clear back navigation time on user interaction

                    const field = fields.find((f) => f.id === fieldId)
                    pushGTM("form_field_interaction", {
                        formName: "quiz_form",
                        fieldId,
                        fieldType: field?.type || "unknown",
                        fieldQuestion: field?.question || field?.progressTitle || "",
                        value: Array.isArray(value) ? value.join(", ") : value,
                    })
                }
            })
        },
        [fields]
    )

    const handleCheckboxToggle = useCallback(
        (
            fieldId: string,
            option: string,
            isUserInteraction: boolean = false
        ) => {
            console.log("☑️ Checkbox toggle:", {
                fieldId,
                option,
                isUserInteraction,
            })

            startTransition(() => {
                setFormData((prev) => {
                    const currentValues = Array.isArray(prev[fieldId])
                        ? [...prev[fieldId]]
                        : []
                    const newValues = currentValues.includes(option)
                        ? currentValues.filter((v) => v !== option)
                        : [...currentValues, option]

                    // Send checkbox interaction event to GTM
                    if (isUserInteraction) {
                        const field = fields.find((f) => f.id === fieldId)
                        pushGTM("form_checkbox_toggle", {
                            formName: "quiz_form",
                            fieldId,
                            fieldQuestion: field?.question || "",
                            option,
                            action: currentValues.includes(option) ? "unchecked" : "checked",
                            currentSelections: newValues.join(", "),
                            selectionCount: newValues.length,
                        })
                    }

                    return {
                        ...prev,
                        [fieldId]: newValues,
                    }
                })

                // Track user interaction
                if (isUserInteraction) {
                    lastUserInteractionRef.current = {
                        fieldId,
                        timestamp: Date.now(),
                    }
                    navigationTypeRef.current = null // Clear navigation type on user interaction
                    backNavigationTimeRef.current = null // Clear back navigation time on user interaction
                }
            })
        },
        [fields]
    )

    const validateCurrentField = useCallback(
        (overrideValue?: any) => {
            if (currentField?.required) {
                const value =
                    overrideValue !== undefined
                        ? overrideValue
                        : formData[currentField.id]
                const isValid =
                    value !== undefined &&
                    value !== "" &&
                    (!Array.isArray(value) || value.length > 0)

                console.log("✅ Field validation:", {
                    fieldId: currentField.id,
                    value,
                    isValid,
                    required: currentField.required,
                })

                return isValid
            }
            return true
        },
        [currentField, formData]
    )

    const handleNext = useCallback(
        (overrideValue?: any) => {
            if (!currentField) {
                console.error("❌ No current field for handleNext")
                return
            }

            console.log("➡️ Handle next called", {
                fieldId: currentField.id,
                overrideValue,
            })

            if (!validateCurrentField(overrideValue)) {
                console.warn("⚠️ Validation failed for current field")

                // Track validation error in GTM
                pushGTM("form_validation_error", {
                    formName: "quiz_form",
                    fieldId: currentField.id,
                    fieldQuestion:
                        currentField.question ||
                        currentField.progressTitle ||
                        "",
                    fieldType: currentField.type,
                })

                startTransition(() => setError(true))
                return
            }

            const currentValue =
                overrideValue !== undefined
                    ? overrideValue
                    : formData[currentField.id]

            const nextFieldId = getNextFieldId(
                currentField,
                currentValue,
                fields
            )

            if (nextFieldId) {
                console.log("✅ Moving to next field:", nextFieldId)

                // Track navigation to next field in GTM
                {
                    const nextField = fields.find((f) => f.id === nextFieldId)
                    pushGTM("form_navigation", {
                        formName: "quiz_form",
                        direction: "forward",
                        fromFieldId: currentField.id,
                        fromFieldQuestion:
                            currentField.question ||
                            currentField.progressTitle ||
                            "",
                        toFieldId: nextFieldId,
                        toFieldQuestion:
                            nextField?.question ||
                            nextField?.progressTitle ||
                            "",
                        currentStep: currentStep + 1,
                        totalSteps: fields.length,
                        progressPercentage:
                            ((currentStep + 2) / fields.length) * 100,
                    })
                }

                startTransition(() => {
                    setError(false)
                    setCurrentFieldId(nextFieldId)
                    setNavigationHistory((prev) => [...prev, nextFieldId])
                    navigationTypeRef.current = "forward"
                    backNavigationTimeRef.current = null // Clear back navigation time on forward movement
                })
            } else {
                console.log("🏁 End of form reached")
            }
        },
        [currentField, fields, formData, validateCurrentField, currentStep]
    )

    const handlePrevious = useCallback(() => {
        console.log("⬅️ Handle previous called")
        setError(false)
        navigationTypeRef.current = "back"
        backNavigationTimeRef.current = Date.now() // Track when back navigation happened

        setNavigationHistory((prev) => {
            const newHistory = [...prev]
            if (newHistory.length > 1) {
                newHistory.pop() // Remove current field
                const previousFieldId = newHistory[newHistory.length - 1]
                console.log("✅ Moving to previous field:", previousFieldId)

                // Track navigation to previous field in GTM
                {
                    const previousField = fields.find(
                        (f) => f.id === previousFieldId
                    )
                    pushGTM("form_navigation", {
                        formName: "quiz_form",
                        direction: "backward",
                        fromFieldId: currentFieldId,
                        fromFieldQuestion:
                            currentField?.question ||
                            currentField?.progressTitle ||
                            "",
                        toFieldId: previousFieldId,
                        toFieldQuestion:
                            previousField?.question ||
                            previousField?.progressTitle ||
                            "",
                        currentStep: Math.max(0, currentStep - 1),
                        totalSteps: fields.length,
                        progressPercentage: (currentStep / fields.length) * 100,
                    })
                }

                setCurrentFieldId(previousFieldId)
                return newHistory
            }
            console.log("ℹ️ Already at first field")
            return prev
        })
    }, [currentFieldId, currentField, fields, currentStep])

    // UPDATED HANDLE SUBMIT with Multi-Action Support and GTM
    const handleSubmit = useCallback(async () => {
        console.log("🚀 Form submission started")

        if (!validateCurrentField()) {
            console.warn("⚠️ Final validation failed")
            startTransition(() => setError(true))
            return
        }

        startTransition(() => {
            setIsSubmitting(true)
            setError(false)
        })

        try {
            // Create GTM payload with questions and answers
            const gtmPayload = {
                event: "form_submission",
                formName: "quiz_form",
                timestamp: new Date().toISOString(),
                sessionId: `form_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                navigationPath: navigationHistory,
                completionTime:
                    Date.now() - (window.formStartTime || Date.now()),
                questionsAndAnswers: fields.reduce(
                    (acc, field) => {
                        if (
                            field.includeInGtmEvent !== false &&
                            formData[field.id] !== undefined &&
                            formData[field.id] !== null
                        ) {
                            const answer = formData[field.id]
                            acc.push({
                                questionId: field.id,
                                questionText:
                                    field.question || field.progressTitle || "",
                                questionType: field.type,
                                answer: Array.isArray(answer)
                                    ? answer.join(", ")
                                    : answer,
                                rawAnswer: answer,
                            })
                        }
                        return acc
                    },
                    [] as Array<{
                        questionId: string
                        questionText: string
                        questionType: string
                        answer: string | number
                        rawAnswer: any
                    }>
                ),
                formData: Object.fromEntries(
                    Object.entries(formData).filter(([key]) => {
                        const f = fields.find((ff) => ff.id === key)
                        return f?.includeInGtmEvent !== false
                    })
                ),
                totalQuestions: fields.length,
                answeredQuestions: Object.keys(formData).length,
                completionRate:
                    (Object.keys(formData).length / fields.length) * 100,
            }

            // Send to GTM dataLayer
            if (typeof window !== "undefined" && window.dataLayer) {
                console.log("📊 Sending GTM event:", gtmPayload)
                window.dataLayer.push(gtmPayload)
            } else {
                console.warn(
                    "⚠️ GTM dataLayer not found, skipping event tracking"
                )
            }

            // If submission actions are configured, use the multi-action service
            if (submissionActions && submissionActions.length > 0) {
                console.log(
                    "🚀 Executing multi-action submission with actions:",
                    submissionActions
                )

                const submissionService = new MultiActionSubmissionService({
                    actions: submissionActions,
                    executeInParallel: executeInParallel || false,
                    includeAnalytics: true,
                })

                const result = await submissionService.executeActions(
                    formData,
                    navigationHistory
                )

                console.log("✅ Multi-action submission result:", result)

                if (result.success) {
                    // Send success event to GTM
                    if (typeof window !== "undefined" && window.dataLayer) {
                        window.dataLayer.push({
                            event: "form_submission_success",
                            formName: "quiz_form",
                            submissionResult: result.summary,
                        })
                    }
                    setSubmissionResult(result)
                    setSubmitted(true)
                } else {
                    throw new Error(
                        `${result.summary.failed} actions failed. Details: ${JSON.stringify(result.results)}`
                    )
                }
            } else {
                // Fallback to original logging behavior if no actions configured
                console.log(
                    "📝 No submission actions configured, logging form data:",
                    {
                        formData: JSON.stringify(formData, null, 2),
                        navigationPath: navigationHistory,
                        timestamp: new Date().toISOString(),
                    }
                )

                // Send success event to GTM for fallback submission
                if (typeof window !== "undefined" && window.dataLayer) {
                    window.dataLayer.push({
                        event: "form_submission_success",
                        formName: "quiz_form",
                        submissionType: "fallback",
                    })
                }

                // Simulate submission delay
                await new Promise((resolve) => setTimeout(resolve, 1000))
                setSubmitted(true)
            }
        } catch (error) {
            console.error("❌ Submission error:", error)

            // Send error event to GTM
            if (typeof window !== "undefined" && window.dataLayer) {
                window.dataLayer.push({
                    event: "form_submission_error",
                    formName: "quiz_form",
                    error:
                        error instanceof Error
                            ? error.message
                            : "Unknown error",
                })
            }

            setError(true)
        } finally {
            setIsSubmitting(false)
        }
    }, [
        validateCurrentField,
        formData,
        navigationHistory,
        submissionActions,
        executeInParallel,
        fields,
    ])

    const isLastStep = useMemo(() => {
        if (!currentField) return true
        const currentValue = formData[currentField.id]
        const nextFieldId = getNextFieldId(currentField, currentValue, fields)
        const result = nextFieldId === null
        console.log("🏁 Is last step check:", {
            fieldId: currentField.id,
            nextFieldId,
            isLast: result,
        })
        return result
    }, [currentField, formData, fields])

    const canGoBack = navigationHistory.length > 1

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (autoAdvanceTimeoutRef.current) {
                clearTimeout(autoAdvanceTimeoutRef.current)
            }
        }
    }, [])

    // Helper function to check if auto-advance should be allowed
    const shouldAllowAutoAdvance = useCallback((fieldId: string) => {
        const navType = navigationTypeRef.current
        const lastInteraction = lastUserInteractionRef.current
        const backNavTime = backNavigationTimeRef.current

        console.log("🔄 Auto-advance check:", {
            fieldId,
            navType,
            lastInteraction,
            backNavTime,
            timeSinceBackNav: backNavTime ? Date.now() - backNavTime : "none",
            timeSinceInteraction: lastInteraction
                ? Date.now() - lastInteraction.timestamp
                : "none",
        })

        // Don't auto-advance if we recently navigated back (within 500ms)
        if (backNavTime && Date.now() - backNavTime < 500) {
            console.log("🚫 Preventing auto-advance: recent back navigation")
            return false
        }

        // Only auto-advance if there was a recent user interaction on this field
        if (!lastInteraction || lastInteraction.fieldId !== fieldId) {
            console.log(
                "🚫 Preventing auto-advance: no recent user interaction on this field"
            )
            return false
        }

        // Check if the interaction was recent (within last 100ms)
        const timeSinceInteraction = Date.now() - lastInteraction.timestamp
        const shouldAllow = timeSinceInteraction < 100

        console.log("🔄 Auto-advance decision:", shouldAllow)
        return shouldAllow
    }, [])

    // Debounced auto-advance function to prevent double-firing
    const triggerAutoAdvance = useCallback(
        (fieldId: string, value: any, field: FormPage) => {
            console.log("🔄 Auto-advance triggered:", { fieldId, value })

            // Clear any existing timeout
            if (autoAdvanceTimeoutRef.current) {
                clearTimeout(autoAdvanceTimeoutRef.current)
            }

            // Set a new timeout
            autoAdvanceTimeoutRef.current = setTimeout(() => {
                if (field.hideNextButton && shouldAllowAutoAdvance(fieldId)) {
                    console.log("✅ Executing auto-advance for field:", fieldId)
                    handleNext(value)
                } else {
                    console.log("🚫 Auto-advance blocked for field:", fieldId)
                }
                autoAdvanceTimeoutRef.current = null
            }, 10) // Very short delay to debounce multiple calls
        },
        [shouldAllowAutoAdvance, handleNext]
    )

    return {
        currentStep,
        currentFieldId,
        navigationHistory,
        formData,
        submitted,
        error,
        isSubmitting,
        isLastStep,
        canGoBack,
        currentField,
        shouldAllowAutoAdvance,
        triggerAutoAdvance,
        submissionResult,
        handleInputChange,
        handleCheckboxToggle,
        handleNext,
        handlePrevious,
        handleSubmit,
    }
}

// ===================================================================
// UI COMPONENTS (Continued...)
// ===================================================================

const FormHeader: React.FC<FormHeaderProps> = ({
    currentStep,
    totalSteps,
    showBackButton,
    showProgressCount,
    onBack,
    textColor,
    disabledColor,
    canGoBack = true,
    currentField, // Add this prop
}) => {
    const isMobile = useIsMobile(768)

    // Hide back button and progress count for progress process pages
    const shouldHideBackButton =
        currentField?.type === "progress process" || !showBackButton
    const shouldHideProgressCount =
        currentField?.type === "progress process" || !showProgressCount

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                maxWidth: "1108px",
                width: "100%",
                margin: "0 auto",
                padding: isMobile
                    ? "1rem 1rem 1rem 1rem"
                    : "1rem 1rem 1.125rem 1rem",
                minHeight: isMobile ? "50px" : "60px",
                ...(currentField?.type === "progress process"
                    ? {
                          boxShadow:
                              "0px 2px 10px 0px rgba(232, 178, 203, 0.20)",
                      }
                    : {}),
            }}
        >
            {shouldHideBackButton ? (
                <div style={{ minWidth: isMobile ? "50px" : "60px" }} />
            ) : (
                <button
                    onClick={onBack}
                    disabled={!canGoBack}
                    style={{
                        background: "none",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        cursor: !canGoBack ? "not-allowed" : "pointer",
                        color: !canGoBack ? disabledColor : textColor,
                        font: "Lexend",
                        fontSize: isMobile ? "0.9rem" : "0.95rem",
                        fontWeight: 500,
                        padding: 0,
                        minWidth: isMobile ? "50px" : "64px",
                    }}
                >
                    <svg
                        width={isMobile ? "20" : "25"}
                        height={isMobile ? "19" : "24"}
                        viewBox="0 0 25 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M15.206 8.115a.998.998 0 0 0-1.411-1.41l-4.588 4.588a1 1 0 0 0 0 1.414l4.588 4.588a.998.998 0 0 0 1.411-1.41L11.33 12z"
                            fill="#A67C8E"
                        />
                    </svg>
                    Back
                </button>
            )}

            <div style={{ flex: 1, textAlign: "center" }}>
                <svg
                    width={isMobile ? "90" : "111"}
                    height={isMobile ? "18" : "22"}
                    viewBox="0 0 111 22"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="m102.965 7.983.078-.744V3.377h1.035v1.742c.157-.19.359-.341.589-.443s.483-.152.737-.144c.834 0 1.596.46 1.596 1.708s-.741 1.811-1.673 1.811a1.75 1.75 0 0 1-.843-.162 1.64 1.64 0 0 1-.644-.538l-.083.617zm1.144-1.435a.8.8 0 0 0 .276.607.9.9 0 0 0 .657.226c.476 0 .922-.235.922-1.102 0-.866-.456-1.042-.927-1.042a.9.9 0 0 0-.662.244.83.83 0 0 0-.266.622zM.5.309h6.34c5.236 0 7.924 2.628 7.924 5.804a4.5 4.5 0 0 1-.903 2.714 4.94 4.94 0 0 1-2.396 1.72l.03.182c2.912.67 4.559 2.78 4.559 5.163 0 3.21-2.683 5.805-7.92 5.805H.5zm2.59 2.138V9.79h4.07c3.528 0 5.014-1.615 5.014-3.666 0-2.05-1.585-3.666-5.334-3.666zm0 9.476v7.635h5.024c3.75 0 5.334-1.65 5.334-3.666 0-2.168-1.486-3.97-5.013-3.97zM23.004.303H20.42V21.69h2.584zM38.673 0c1.514.007 3.012.298 4.407.855a11.5 11.5 0 0 1 3.718 2.394 10.8 10.8 0 0 1 2.456 3.562c.56 1.33.837 2.75.813 4.182 0 6.264-5.008 11.002-11.348 11.002s-11.317-4.738-11.317-11.002S32.39 0 38.672 0m0 19.866c4.723 0 8.763-3.822 8.763-8.864 0-4.703-3.848-8.858-8.763-8.858-4.916 0-8.733 4.155-8.733 8.858 0 5.042 3.848 8.864 8.733 8.864M76.01 4.249l-.192-.03-.228.915-8.085 16.563h-2.102L57.317 5.134l-.29-1.194-.191.034v17.723h-2.59V.309h3.367l8.375 17.536.352 1.165h.197l.42-1.194L75.3.309h3.3v21.388h-2.59zm20.185 11.002h-8.96l-2.425 6.446h-2.978L90.502.309h2.424l8.665 21.388h-2.973zm-8.153-2.139h7.34l-3.424-9.167-.166-.641H91.6l-.13.641z"
                        fill="#212529"
                    />
                    <path
                        d="M104.803 11.105a5.93 5.93 0 0 1-3.165-.907 5.46 5.46 0 0 1-2.099-2.416 5.1 5.1 0 0 1-.324-3.11 5.3 5.3 0 0 1 1.559-2.757A5.8 5.8 0 0 1 103.691.44a6 6 0 0 1 3.292.307 5.64 5.64 0 0 1 2.557 1.983c.626.885.96 1.926.96 2.99 0 1.429-.6 2.798-1.669 3.808s-2.517 1.576-4.028 1.576m0-9.842c-.933 0-1.846.261-2.622.751a4.5 4.5 0 0 0-1.737 2.001 4.22 4.22 0 0 0-.269 2.577 4.4 4.4 0 0 0 1.291 2.282 4.8 4.8 0 0 0 2.416 1.22 4.97 4.97 0 0 0 2.726-.253 4.67 4.67 0 0 0 2.118-1.642 4.3 4.3 0 0 0 .795-2.477 4.34 4.34 0 0 0-1.383-3.152 4.87 4.87 0 0 0-3.335-1.307"
                        fill="#212529"
                    />
                </svg>
            </div>

            {shouldHideProgressCount ? (
                <div style={{ minWidth: isMobile ? "50px" : "60px" }} />
            ) : (
                <div
                    style={{
                        fontSize: isMobile ? "0.8rem" : "0.875rem",
                        color: "#212529",
                        minWidth: isMobile ? "50px" : "60px",
                        textAlign: "right",
                    }}
                >
                    <span style={{ fontWeight: 600 }}>{currentStep + 1}</span>{" "}
                    of {totalSteps}
                </div>
            )}
        </div>
    )
}

const ProgressBar: React.FC<ProgressBarProps> = ({
    currentStep,
    totalSteps,
    primaryColor,
}) => (
    <div
        style={{
            width: "100%",
            height: "4px",
            backgroundColor: "#E8B2CB",
            position: "relative",
            flexShrink: 0,
        }}
    >
        <div
            style={{
                height: "100%",
                backgroundColor: primaryColor,
                width: `${((currentStep + 1) / totalSteps) * 100}%`,
                transition: "width 0.3s ease",
            }}
        />
    </div>
)

// Progress Process Component
const ProgressProcessPage: React.FC<{
    field: FormPage
    onNext: () => void
    primaryColor: string
    backgroundColor: string
    textColor: string
}> = ({ field, onNext, primaryColor, backgroundColor, textColor }) => {
    const isMobile = useIsMobile(768)
    const [currentStepIndex, setCurrentStepIndex] = useState(0)
    const [progressValue, setProgressValue] = useState(0)

    const progressSteps = field.progressSteps || [
        {
            id: "step1",
            label: "Evaluating your answers…",
            completed: false,
            active: true,
        },
        {
            id: "step2",
            label: "Analyzing your results…",
            completed: false,
            active: false,
        },
        {
            id: "step3",
            label: "Assessing your flora balance…",
            completed: false,
            active: false,
        },
        {
            id: "step4",
            label: "Building your summary…",
            completed: false,
            active: false,
        },
    ]

    const progressBarBgColor = field.progressBarBgColor || "#E8B2CB"
    const progressBarValueColor = field.progressBarValueColor || "#632240"
    const autoAdvanceDelay = field.autoAdvanceDelay || 2000

    // Default BIOMA logo SVG
    const biomaLogoSvg =
        field.logoSvg ||
        `
        <svg width="107" height="135" viewBox="0 0 107 135" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M56.666 0C59.374 0.515 62.135 0.847 64.784 1.58C81.791 6.276 93.967 20.973 95.529 38.562C97.482 60.576 82.267 80.399 60.584 84.089C36.923 88.114 14.718 71.604 11.587 47.661C8.621 25.002 24.701 3.715 47.223 0.483C48.26 0.335 49.296 0.162 50.333 0C52.445 0 54.558 0 56.666 0ZM90.116 42.302C90.077 22.07 73.673 5.641 53.5 5.623C33.354 5.609 16.919 22.066 16.88 42.295C16.837 62.527 33.411 79.129 53.56 79.037C73.776 78.949 90.155 62.488 90.116 42.298V42.302Z" fill="#A67C8E"/>
            <path d="M52.707 135.467C51.138 134.698 50.616 133.407 50.64 131.699C50.7 127.381 50.662 123.06 50.662 118.534C50.14 118.534 49.678 118.534 49.219 118.534C44.205 118.534 39.191 118.541 34.176 118.53C32.477 118.527 31.306 117.655 31.059 116.269C30.728 114.399 31.955 112.938 33.982 112.924C38.863 112.893 43.747 112.914 48.63 112.91C49.237 112.91 49.847 112.91 50.559 112.91V96.09C47.417 95.557 44.304 95.229 41.296 94.481C24.349 90.283 12.187 80.147 4.746 64.364C1.566 57.626 0.138 50.436 0 42.989C-0.035 41.073 0.73 39.927 2.257 39.595C3.935 39.232 5.448 40.375 5.625 42.245C5.854 44.654 5.836 47.099 6.206 49.484C9.239 69.141 23.548 84.603 42.773 89.094C68.875 95.19 95.272 78.158 100.399 51.833C100.984 48.824 101.066 45.713 101.323 42.643C101.51 40.438 102.984 39.14 104.863 39.631C106.246 39.99 107.021 41.066 106.997 42.724C106.87 51.555 104.913 59.954 100.611 67.68C91.911 83.301 78.692 92.548 61.06 95.43C60.281 95.557 59.491 95.642 58.705 95.719C57.971 95.793 57.234 95.829 56.42 95.889V112.921C56.907 112.921 57.372 112.921 57.837 112.921C62.894 112.921 67.954 112.903 73.011 112.935C75.038 112.949 76.269 114.41 75.934 116.279C75.684 117.676 74.531 118.537 72.817 118.541C67.848 118.551 62.876 118.544 57.908 118.544C57.435 118.544 56.959 118.544 56.332 118.544C56.332 120.456 56.332 122.248 56.332 124.04C56.332 126.598 56.279 129.156 56.349 131.71C56.395 133.417 55.849 134.702 54.283 135.478H52.7L52.707 135.467Z" fill="#632240"/>
        </svg>
    `

    useEffect(() => {
        console.log("🔄 Progress process started with delay:", autoAdvanceDelay)
        const stepDuration = autoAdvanceDelay
        const totalDuration = stepDuration * progressSteps.length
        const progressIncrement = 100 / progressSteps.length

        const interval = setInterval(() => {
            setCurrentStepIndex((prev) => {
                const nextIndex = prev + 1
                if (nextIndex >= progressSteps.length) {
                    clearInterval(interval)
                    // Auto advance to next form page after completion
                    console.log(
                        "✅ Progress process completed, advancing to next page"
                    )
                    setTimeout(() => {
                        onNext()
                    }, 500)
                    return prev
                }
                console.log(
                    `🔄 Progress step ${nextIndex}/${progressSteps.length}`
                )
                return nextIndex
            })

            setProgressValue((prev) => {
                const nextValue = prev + progressIncrement
                return Math.min(nextValue, 100)
            })
        }, stepDuration)

        return () => {
            console.log("🧹 Progress process cleanup")
            clearInterval(interval)
        }
    }, [progressSteps.length, autoAdvanceDelay, onNext])

    const renderStepIcon = (step: ProgressStep, index: number) => {
        const isCompleted = index < currentStepIndex
        const isActive = index === currentStepIndex
        const isUpcoming = index > currentStepIndex

        if (isCompleted) {
            return (
                <div
                    style={{
                        width: isMobile ? "20px" : "25px",
                        height: isMobile ? "19px" : "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "8px",
                        flexShrink: 0,
                        animation: "unset",
                    }}
                >
                    <svg
                        width="25"
                        height="24"
                        viewBox="0 0 25 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M12.5 22a9.7 9.7 0 0 1-3.9-.788 10.1 10.1 0 0 1-3.175-2.137q-1.35-1.35-2.137-3.175A9.7 9.7 0 0 1 2.5 12q0-2.075.788-3.9a10.1 10.1 0 0 1 2.137-3.175q1.35-1.35 3.175-2.137A9.7 9.7 0 0 1 12.5 2q1.2 0 2.338.275 1.137.275 2.187.8.375.2.488.6a.84.84 0 0 1-.138.75 1.1 1.1 0 0 1-.663.45 1.16 1.16 0 0 1-.812-.1 8.4 8.4 0 0 0-1.662-.575A7.7 7.7 0 0 0 12.5 4Q9.175 4 6.838 6.338 4.5 8.675 4.5 12t2.338 5.663T12.5 20t5.663-2.337T20.5 12a6 6 0 0 0-.05-.775 1.33 1.33 0 0 1 .163-.812q.212-.389.637-.513a.9.9 0 0 1 .75.075.77.77 0 0 1 .4.6A10 10 0 0 1 22.5 12a9.7 9.7 0 0 1-.788 3.9 10.1 10.1 0 0 1-2.137 3.175q-1.35 1.35-3.175 2.137a9.7 9.7 0 0 1-3.9.788m-1.4-8.2 9.3-9.325a.98.98 0 0 1 .688-.287.93.93 0 0 1 .712.287.95.95 0 0 1 .275.7.95.95 0 0 1-.275.7L11.8 15.9q-.3.3-.7.3a.96.96 0 0 1-.7-.3l-2.85-2.85a.95.95 0 0 1-.275-.7q0-.425.275-.7a.95.95 0 0 1 .7-.275q.425 0 .7.275z"
                            fill="#632240"
                        />
                    </svg>
                </div>
            )
        }

        if (isActive) {
            return (
                <div
                    style={{
                        width: isMobile ? "20px" : "25px",
                        height: isMobile ? "19px" : "24px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: "8px",
                        flexShrink: 0,
                        position: "relative",
                        color: progressBarValueColor,
                        animation: "spin 1s linear infinite",
                    }}
                >
                    <svg
                        width="25"
                        height="24"
                        viewBox="0 0 25 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path
                            d="M21.5 12a9 9 0 1 1-9-9"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />
                    </svg>
                </div>
            )
        }

        // Upcoming step
        return (
            <div
                style={{
                    width: isMobile ? "20px" : "25px",
                    height: isMobile ? "19px" : "24px",
                    marginRight: "8px",
                    flexShrink: 0,
                    color: "#63224040",
                }}
            >
                <svg
                    width="25"
                    height="24"
                    viewBox="0 0 25 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M21.5 12a9 9 0 1 1-9-9"
                        stroke="currentColor"
                        strokeOpacity=".25"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                </svg>
            </div>
        )
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                width: "100%",
                padding: isMobile ? "2rem 1rem" : "3rem 2rem",
                textAlign: "center",
                color: textColor,
            }}
        >
            {/* BIOMA Logo */}
            <div
                style={{
                    marginBottom: isMobile ? "3rem" : "4rem",
                    opacity: 0.9,
                }}
                dangerouslySetInnerHTML={{ __html: biomaLogoSvg }}
            />

            {/* Main Title */}
            <h2
                style={{
                    fontSize: isMobile ? "1.5rem" : "1.75rem",
                    fontWeight: 500,
                    lineHeight: 1.3,
                    marginBottom: isMobile ? "1.5rem" : "2rem",
                    color: textColor,
                    maxWidth: "600px",
                }}
            >
                {field.progressTitle || field.question}
            </h2>

            {/* Progress Bar */}
            <div
                style={{
                    width: "100%",
                    maxWidth: isMobile ? "300px" : "358px",
                    height: "5px",
                    backgroundColor: progressBarBgColor,
                    borderRadius: "2.5px",
                    marginBottom: isMobile ? "2.5rem" : "3rem",
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        backgroundColor: progressBarValueColor,
                        width: `${progressValue}%`,
                        borderRadius: "2.5px",
                        transition: "width 0.3s ease",
                    }}
                />
            </div>

            {/* Progress Steps */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: isMobile ? "1rem" : "1.5rem",
                    width: "100%",
                    maxWidth: "400px",
                }}
            >
                {progressSteps.map((step, index) => {
                    const isCompleted = index < currentStepIndex
                    const isActive = index === currentStepIndex
                    const opacity = isCompleted ? 1 : isActive ? 1 : 0.25

                    return (
                        <div
                            key={step.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                opacity: opacity,
                                transition: "opacity 0.3s ease",
                            }}
                        >
                            {renderStepIcon(step, index)}
                            <span
                                style={{
                                    fontSize: isMobile ? "0.875rem" : "1rem",
                                    fontWeight: 500,
                                    color: progressBarValueColor,
                                    textAlign: "left",
                                }}
                            >
                                {step.label}
                            </span>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// Continuing with FormPage component...
const FormPage: React.FC<
    FormPageProps & {
        shouldAllowAutoAdvance: (fieldId: string) => boolean
        isLastStep: boolean
        isSubmitting: boolean
        submitButtonText: string
        nextButtonText: string
        buttonTextColor: string
        onSubmit: () => void
    }
> = ({
    field,
    value,
    onChange,
    onCheckboxToggle,
    onNext,
    primaryColor,
    secondaryColor,
    backgroundColor,
    textColor,
    hideNextButton,
    shouldAllowAutoAdvance,
    triggerAutoAdvance,
    onSubmit,
    isLastStep,
    isSubmitting,
    submitButtonText,
    nextButtonText,
    buttonTextColor,
}) => {
    const isMobile = useIsMobile(768)

    // Handle progress process type
    if (field.type === "progress process") {
        return (
            <ProgressProcessPage
                field={field}
                onNext={onNext}
                primaryColor={primaryColor}
                backgroundColor={backgroundColor}
                textColor={textColor}
            />
        )
    }

    const renderFieldInput = () => {
        const containerStyles = {
            display: "flex",
            flexDirection: "column" as const,
            maxWidth: isMobile ? "100%" : "22.375rem",
            width: "100%",
            placeSelf: "center" as const,
            gap: isMobile ? "0.5rem" : "0.75rem",
            margin: "0 auto",
            padding: isMobile ? "0 0.5rem" : "0",
        }

        const labelStyles = (isSelected: boolean) => ({
            display: "flex",
            alignItems: "center",
            padding: isMobile ? "0.75rem 1rem" : "1rem 1.125rem",
            height: isMobile ? "52px" : "58px",
            borderRadius: "8px",
            border: isSelected ? "1px solid #733C55" : "1px solid #F2F2F2",
            userSelect: "none" as const,
            color: isSelected ? "#FFFFFF" : "inherit",
            width: "100%",
            maxWidth: isMobile ? "100%" : "22.375rem",
            backgroundColor: isSelected ? "#A67C8E" : "#fff",
            cursor: "pointer",
            transition: "all 0.2s ease",
            placeSelf: "center" as const,
            font: "inherit",
            fontSize: isMobile ? "15px" : "16px",
            fontWeight: 500,
        })

        const inputStyles = {
            display: "flex",
            padding: "1rem",
            alignItems: "flex-start",
            gap: "0.625rem",
            alignSelf: "stretch",
            borderRadius: "0.25rem",
            border: "1px solid #F2F2F2",
            background: "#FFF",
            width: "100%",
            fontSize: isMobile ? "16px" : "1rem",
            outline: "none",
            transition: "border-color 0.2s ease",
        }

        switch (field.type) {
            case "radio":
                return (
                    <div style={containerStyles}>
                        {field.options?.map((option) => (
                            <label
                                key={option}
                                style={labelStyles(value === option)}
                                onClick={() => {
                                    console.log("🔘 Radio option clicked:", {
                                        option,
                                        fieldId: field.id,
                                    })
                                    // Always update the value
                                    onChange(field.id, option, true) // Mark as user interaction

                                    // Use debounced auto-advance function
                                    if (triggerAutoAdvance) {
                                        triggerAutoAdvance(
                                            field.id,
                                            option,
                                            field
                                        )
                                    }
                                }}
                            >
                                <div
                                    style={{
                                        width: isMobile
                                            ? "1.125rem"
                                            : "1.625rem",
                                        height: isMobile
                                            ? "1.125rem"
                                            : "1.625rem",
                                        borderRadius: "50%",
                                        border: `2px solid ${value === option ? "#fff" : "#F2F2F2"}`,
                                        backgroundColor:
                                            value === option
                                                ? secondaryColor
                                                : "#F2F2F2",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                        order: 1,
                                    }}
                                >
                                    {value === option && (
                                        <div
                                            style={{
                                                width: isMobile ? "6px" : "8px",
                                                height: isMobile
                                                    ? "6px"
                                                    : "8px",
                                                borderRadius: "50%",
                                                backgroundColor: "#fff",
                                            }}
                                        />
                                    )}
                                </div>
                                <input
                                    type="radio"
                                    name={field.id}
                                    value={option}
                                    checked={value === option}
                                    onChange={() => {}}
                                    style={{ display: "none" }}
                                />
                                <span style={{ flex: 1, textAlign: "left" }}>
                                    {option}
                                </span>
                            </label>
                        ))}
                    </div>
                )

            case "checkbox":
                return (
                    <div style={containerStyles}>
                        {field.options?.map((option) => {
                            const isSelected =
                                Array.isArray(value) && value.includes(option)

                            return (
                                <label
                                    key={option}
                                    style={labelStyles(isSelected)}
                                >
                                    <div
                                        style={{
                                            width: isMobile
                                                ? "1.125rem"
                                                : "1.625rem",
                                            height: isMobile
                                                ? "1.125rem"
                                                : "1.625rem",
                                            borderRadius: "0.125rem",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            order: 1,
                                            flexShrink: 0,
                                            backgroundColor: isSelected
                                                ? "#fff"
                                                : "#F2F2F2",
                                        }}
                                    >
                                        {isSelected && (
                                            <svg
                                                width={isMobile ? "11" : "13"}
                                                height={isMobile ? "8" : "10"}
                                                viewBox="0 0 13 10"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path
                                                    d="M4.5 9.4 1.2 6.1a.99.99 0 1 1 1.4-1.4l1.9 1.9L10.4.7a.99.99 0 0 1 1.4 1.4z"
                                                    fill="#A67C8E"
                                                />
                                            </svg>
                                        )}
                                    </div>
                                    <input
                                        type="checkbox"
                                        value={option}
                                        checked={isSelected}
                                        onChange={() => {
                                            console.log(
                                                "☑️ Checkbox option toggled:",
                                                { option, fieldId: field.id }
                                            )
                                            // Always update the value
                                            onCheckboxToggle(
                                                field.id,
                                                option,
                                                true
                                            ) // Mark as user interaction

                                            // Use debounced auto-advance function
                                            if (triggerAutoAdvance) {
                                                const currentValues =
                                                    Array.isArray(value)
                                                        ? [...value]
                                                        : []
                                                const newValues =
                                                    currentValues.includes(
                                                        option
                                                    )
                                                        ? currentValues.filter(
                                                              (v) =>
                                                                  v !== option
                                                          )
                                                        : [
                                                              ...currentValues,
                                                              option,
                                                          ]
                                                triggerAutoAdvance(
                                                    field.id,
                                                    newValues,
                                                    field
                                                )
                                            }
                                        }}
                                        style={{ display: "none" }}
                                    />
                                    <span
                                        style={{ flex: 1, textAlign: "left" }}
                                    >
                                        {option}
                                    </span>
                                </label>
                            )
                        })}
                    </div>
                )

            case "text":
            case "email":
                return (
                    <div style={containerStyles}>
                        <input
                            type={field.type}
                            value={value || ""}
                            onChange={(e) => {
                                console.log("📝 Text input changed:", {
                                    fieldId: field.id,
                                    value: e.target.value,
                                })
                                onChange(field.id, e.target.value, true)
                            }}
                            placeholder={field.placeholder}
                            style={inputStyles}
                        />
                        {field.emailSubtext && (
                            <div
                                style={{
                                    color: "#212529",
                                    textAlign: "center",
                                    fontFamily: "Lexend",
                                    fontSize: "1rem",
                                    fontStyle: "normal",
                                    fontWeight: 300,
                                    lineHeight: "1.5rem",
                                    margin: "1rem 0 0.5rem 0",
                                }}
                                dangerouslySetInnerHTML={{
                                    __html: field.emailSubtext.replace(
                                        /<b>(.*?)<\/b>/g,
                                        (match, p1) =>
                                            `<span style='color:#632240;font-family:Lexend;font-size:1rem;font-style:normal;font-weight:500;line-height:1.5rem;'>${p1}</span>`
                                    ),
                                }}
                            />
                        )}
                        {/* Render FormButton if this is the last step */}
                        {isLastStep && (
                            <FormButton
                                isLastStep={isLastStep}
                                isSubmitting={isSubmitting}
                                onNext={onNext}
                                onSubmit={onSubmit}
                                primaryColor={primaryColor}
                                buttonTextColor={buttonTextColor}
                                submitButtonText={
                                    field.emailSubmitButtonText ||
                                    submitButtonText
                                }
                                nextButtonText={nextButtonText}
                                borderRadius={"8px"}
                            >
                                {/* Add SVG after button text for email field */}
                                <span
                                    style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        marginLeft: "0.5rem",
                                    }}
                                >
                                    <svg
                                        width={isMobile ? "20" : "25"}
                                        height={isMobile ? "19" : "24"}
                                        viewBox="0 0 25 24"
                                        fill="none"
                                        xmlns="http://www.w3.org/2000/svg"
                                    >
                                        <circle
                                            cx="12.5"
                                            cy="12"
                                            r="12"
                                            fill="#fff"
                                        />
                                        <path
                                            fill="#fff"
                                            d="M4.5 4h16v16h-16z"
                                        />
                                        <path
                                            d="m15.282 11.333-3.576-3.576.942-.943L17.834 12l-5.186 5.185-.942-.942 3.576-3.576H7.167v-1.334z"
                                            fill="#632240"
                                        />
                                    </svg>
                                </span>
                            </FormButton>
                        )}
                    </div>
                )

            case "number":
                // Check if slider should be used
                if (field.useSlider) {
                    const min = field.sliderMin ?? 0
                    const max = field.sliderMax ?? 120
                    const currentValue =
                        value !== undefined ? value : (field.sliderValue ?? min)

                    const SafeAgeSelector = AgeSelector || FallbackAgeSelector

                    return (
                        <div style={{ placeSelf: "center" }}>
                            <SafeAgeSelector
                                value={currentValue}
                                minAge={min}
                                maxAge={max}
                                width={358}
                                height={178}
                                onChange={(age: number) => {
                                    console.log("🔢 Age selector changed:", {
                                        fieldId: field.id,
                                        age,
                                    })
                                    onChange(field.id, age, true)
                                }}
                            />
                        </div>
                    )
                }

                // Default number input
                return (
                    <div style={containerStyles}>
                        <input
                            type="number"
                            value={value || ""}
                            onChange={(e) => {
                                console.log("🔢 Number input changed:", {
                                    fieldId: field.id,
                                    value: e.target.value,
                                })
                                onChange(field.id, e.target.value, true)
                            }}
                            placeholder={field.placeholder}
                            style={inputStyles}
                        />
                    </div>
                )

            case "textarea":
                return (
                    <div style={containerStyles}>
                        <textarea
                            value={value || ""}
                            onChange={(e) => {
                                console.log("📝 Textarea changed:", {
                                    fieldId: field.id,
                                    value: e.target.value,
                                })
                                onChange(field.id, e.target.value, true)
                            }}
                            placeholder={field.placeholder}
                            rows={isMobile ? 3 : 4}
                            style={{
                                ...inputStyles,
                                resize: "vertical",
                                fontFamily: "inherit",
                            }}
                        />
                    </div>
                )

            case "select":
                return (
                    <div style={containerStyles}>
                        <select
                            value={value || ""}
                            onChange={(e) => {
                                console.log("📋 Select changed:", {
                                    fieldId: field.id,
                                    value: e.target.value,
                                })
                                onChange(field.id, e.target.value, true)
                            }}
                            style={inputStyles}
                        >
                            <option value="">Select an option</option>
                            {field.options?.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                )

            default:
                return null
        }
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                maxWidth: "548px",
                width: "100%",
                placeSelf: "center",
                gap: "0.75rem",
                padding: isMobile ? "0 0.5rem" : "0",
            }}
        >
            <h2
                style={{
                    fontSize: isMobile ? "1.5rem" : "1.75rem",
                    fontWeight: 500,
                    lineHeight: 1.3,
                    marginBottom: "0",
                    color: "#333",
                    maxWidth: "600px",
                    margin: "0 auto 1rem",
                    textAlign: "center",
                    padding: isMobile ? "0 0.5rem" : "0",
                }}
            >
                {field.question}
            </h2>

            {/* Only render subtext for non-email fields */}
            {field.type !== "email" && field.subtext && (
                <p
                    style={{
                        fontSize: isMobile ? "0.7rem" : "0.75rem",
                        color: "#888",
                        textTransform: "uppercase",
                        letterSpacing: "0.06rem",
                        fontWeight: 500,
                        marginBottom: isMobile ? "2rem" : "3rem",
                        padding: isMobile ? "0" : "0",
                    }}
                >
                    {field.subtext}
                </p>
            )}

            <div
                style={{
                    maxWidth: "500px",
                    margin: "0 auto",
                    width: "100%",
                    paddingBottom: "5rem",
                }}
            >
                {renderFieldInput()}
            </div>
        </div>
    )
}

const ContentPage: React.FC<ContentPageProps> = ({
    field,
    onNext,
    primaryColor,
    secondaryColor,
    backgroundColor,
    textColor,
    buttonTextColor,
}) => {
    const isMobile = useIsMobile(768) // Add mobile detection

    console.log("🎯 ContentPage component rendering")
    console.log("🎯 Field:", field)
    console.log("🎯 Content component key:", field.contentComponentKey)
    console.log("🎯 Is mobile:", isMobile) // Add mobile debug
    console.log(
        "🎯 Available components:",
        Object.keys(CustomContentComponents)
    )
    console.log("🎯 onNext function:", typeof onNext)

    // Get the custom component from the registry
    const CustomComponent = field.contentComponentKey
        ? CustomContentComponents[field.contentComponentKey]
        : null

    console.log("🎯 Found custom component:", !!CustomComponent)

    // If no custom component is found, render a fallback
    if (!CustomComponent) {
        console.warn(
            `Content component "${field.contentComponentKey}" not found in CustomContentComponents`
        )
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: isMobile ? "1.5rem" : "2rem",
                    textAlign: "center",
                    color: textColor,
                }}
            >
                <h2
                    style={{
                        color: textColor,
                        marginBottom: "1rem",
                        fontSize: isMobile ? "1.25rem" : "1.5rem", // Make responsive
                    }}
                >
                    {field.question}
                </h2>
                <p
                    style={{
                        color: textColor,
                        marginBottom: "2rem",
                        fontSize: isMobile ? "0.875rem" : "1rem", // Make responsive
                    }}
                >
                    Content component "{field.contentComponentKey}" not found.
                </p>
                <button
                    onClick={() => onNext()}
                    style={{
                        padding: isMobile ? "12px 24px" : "16px 32px", // Make responsive
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: primaryColor,
                        color: buttonTextColor,
                        fontSize: isMobile ? "0.875rem" : "1rem", // Make responsive
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    Continue
                </button>
            </div>
        )
    }

    console.log("🎯 About to render CustomComponent with props")

    // Create a wrapper div that can receive overrides
    return (
        <div
            data-framer-name="ContentWrapper"
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                placeItems: "center",
                placeContent: "center",
                padding: isMobile ? "1.5rem" : "2rem",
            }}
        >
            <CustomComponent
                field={field}
                onNext={onNext}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                backgroundColor={backgroundColor}
                textColor={textColor}
                buttonTextColor={buttonTextColor}
                isMobile={isMobile} // Add mobile prop
                variant={isMobile ? "Mobile" : "Desktop"} // Add variant prop
                // Add some debug props to help troubleshoot
                _debug={{
                    hasOnNext: !!onNext,
                    onNextType: typeof onNext,
                    componentKey: field.contentComponentKey,
                    isMobile: isMobile, // Add mobile info to debug
                    deviceType: isMobile ? "Mobile" : "Desktop", // Add device type
                }}
            />
        </div>
    )
}

const FormButton: React.FC<FormButtonProps> = ({
    isLastStep,
    isSubmitting,
    onNext,
    onSubmit,
    primaryColor,
    buttonTextColor,
    submitButtonText,
    nextButtonText,
    borderRadius,
    children,
}) => {
    const isMobile = useIsMobile(768)

    return (
        <button
            onClick={isLastStep ? onSubmit : () => onNext()}
            disabled={isSubmitting}
            style={{
                display: "flex",
                width: "100%",
                maxWidth: isMobile ? "100%" : "22.375rem",
                placeSelf: "center",
                alignSelf: "center",
                margin: "0 auto",
                padding: isMobile ? "14px 20px" : "16px 24px",
                borderRadius: borderRadius,
                border: "none",
                backgroundColor: primaryColor,
                color: buttonTextColor,
                fontFamily: "inherit",
                fontSize: isMobile ? "0.95rem" : "1rem",
                fontWeight: 500,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                alignItems: "center",
                justifyContent: "center",
                opacity: isSubmitting ? 0.7 : 1,
                minHeight: isMobile ? "50px" : "56px",
            }}
        >
            {isSubmitting ? (
                <div
                    style={{
                        width: "20px",
                        height: "20px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: buttonTextColor,
                        borderRadius: "50%",
                        animation: "spin 1s linear infinite",
                    }}
                />
            ) : (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                    }}
                >
                    <span>
                        {isLastStep ? submitButtonText : nextButtonText}
                    </span>
                    {children}
                    {!isLastStep && !children && (
                        <svg
                            width={isMobile ? "20" : "25"}
                            height={isMobile ? "19" : "24"}
                            viewBox="0 0 25 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle cx="12.5" cy="12" r="12" fill="#fff" />
                            <path fill="#fff" d="M4.5 4h16v16h-16z" />
                            <path
                                d="m15.282 11.333-3.576-3.576.942-.943L17.834 12l-5.186 5.185-.942-.942 3.576-3.576H7.167v-1.334z"
                                fill="#632240"
                            />
                        </svg>
                    )}
                </div>
            )}
        </button>
    )
}

// ===================================================================
// MAIN COMPONENT
// ===================================================================

/**
 * Multi-step form component that collects user input and prepares it for submission
 *
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight fixed
 */
export default function QuizForm(props: any) {
    console.log("🎯 QuizForm props:", props)
    console.log("🎯 All prop keys:", Object.keys(props))
    console.log("🎯 Fields from props:", props.fields)
    console.log("🎯 Submission Actions from props:", props.submissionActions) // Add this log

    const {
        title = "Multi-Step Form",
        subtitle = "Please fill out all required fields",
        fields: framerFields = [],
        primaryColor = "#A67C8E",
        secondaryColor = "#632240",
        backgroundColor = "#FEFEFE",
        textColor = "#333333",
        disabledColor = "#CCCCCC",
        buttonTextColor = "#FFFFFF",
        borderRadius = 8,
        successMessage = "Thank you for your submission!",
        errorMessage = "An error occurred. Please try again.",
        submitButtonText = "Submit",
        previousButtonText = "Previous",
        nextButtonText = "Next",
        showBackButton = true,
        showProgressCount = true,
        submissionActions = [], // ✅ Add this line
        executeInParallel = false, // ✅ Add this line
        onSubmissionSuccess,
        onSubmissionError,
    } = props

    const isMobile = useIsMobile(768)

    // Convert Framer fields to internal FormPage format
    const fields = useMemo(() => {
        console.log("🔄 Converting framer fields to form pages...")
        return framerFields ? convertFramerFieldsToFormPages(framerFields) : []
    }, [framerFields])

    // Debug logging to see what fields we're getting
    console.log("🎯 Framer Fields:", framerFields)
    console.log("🎯 Converted Fields:", fields)
    console.log("🎯 Fields Length:", fields.length)
    console.log("🎯 Submission Actions:", submissionActions) // ✅ Add this log

    // Safety check - if no fields, don't render the form
    if (!fields || fields.length === 0 || !framerFields) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    fontFamily: "Lexend, sans-serif",
                    background: backgroundColor,
                    color: textColor,
                    textAlign: "center",
                    padding: "2rem",
                }}
            >
                <div>
                    <h2 style={{ marginBottom: "1rem" }}>
                        Form Configuration Missing
                    </h2>
                    <p style={{ marginBottom: "1rem" }}>
                        No form fields configured. Please add fields in the
                        Framer properties panel.
                    </p>
                    <details
                        style={{
                            textAlign: "left",
                            fontSize: "12px",
                            color: "#666",
                        }}
                    >
                        <summary
                            style={{
                                cursor: "pointer",
                                marginBottom: "0.5rem",
                            }}
                        >
                            Debug Info
                        </summary>
                        <div>
                            <p>Fields prop type: {typeof framerFields}</p>
                            <p>
                                Fields is array:{" "}
                                {Array.isArray(framerFields) ? "Yes" : "No"}
                            </p>
                            <p>Fields length: {framerFields?.length || 0}</p>
                            <p>
                                Fields content:{" "}
                                {JSON.stringify(framerFields, null, 2)}
                            </p>
                        </div>
                    </details>
                </div>
            </div>
        )
    }

    // ✅ UPDATED: Pass submission actions to the form logic hook
    const {
        currentStep,
        currentFieldId,
        navigationHistory,
        formData,
        submitted,
        error,
        isSubmitting,
        isLastStep,
        canGoBack,
        currentField,
        shouldAllowAutoAdvance,
        triggerAutoAdvance,
        submissionResult, // ✅ Add this
        handleInputChange,
        handleCheckboxToggle,
        handleNext,
        handlePrevious,
        handleSubmit,
    } = useFormLogic(fields, submissionActions, executeInParallel) // ✅ Pass the new parameters

    // ✅ ADD: Handle submission callbacks
    useEffect(() => {
        if (submitted && submissionResult) {
            console.log(
                "✅ Form submitted successfully, calling onSubmissionSuccess"
            )
            onSubmissionSuccess?.(submissionResult)
        }
    }, [submitted, submissionResult, onSubmissionSuccess])

    useEffect(() => {
        if (error && !isSubmitting) {
            console.log("❌ Form submission error, calling onSubmissionError")
            onSubmissionError?.("Form submission failed")
        }
    }, [error, isSubmitting, onSubmissionError])

    // If form is submitted, show success message
    if (submitted) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    fontFamily: "Lexend, sans-serif",
                    backgroundColor,
                    padding: isMobile ? "1.5rem" : "2rem",
                }}
            >
                <div
                    style={{
                        fontSize: isMobile ? "48px" : "64px",
                        marginBottom: "1rem",
                    }}
                >
                    ✅
                </div>
                <h1
                    style={{
                        fontSize: isMobile ? "1.5rem" : "2rem",
                        fontWeight: 600,
                        color: textColor,
                        marginBottom: "0.5rem",
                        textAlign: "center",
                    }}
                >
                    {successMessage || "Form submitted successfully!"}
                </h1>
                <p
                    style={{
                        fontSize: isMobile ? "0.875rem" : "1rem",
                        color: textColor,
                        opacity: 0.8,
                        textAlign: "center",
                    }}
                >
                    Thank you for completing the form.
                </p>

                {/* Debug info for successful submission */}
                {submissionResult && (
                    <details
                        style={{
                            marginTop: "2rem",
                            fontSize: "12px",
                            color: "#666",
                        }}
                    >
                        <summary style={{ cursor: "pointer" }}>
                            Submission Details
                        </summary>
                        <pre
                            style={{
                                textAlign: "left",
                                marginTop: "0.5rem",
                                maxWidth: "300px",
                                overflow: "auto",
                            }}
                        >
                            {JSON.stringify(submissionResult, null, 2)}
                        </pre>
                    </details>
                )}
            </div>
        )
    }

    // If there's an error but no current field, show error message
    if (error && !currentField) {
        return (
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    fontFamily: "Lexend, sans-serif",
                    backgroundColor,
                    padding: isMobile ? "1.5rem" : "2rem",
                }}
            >
                <div
                    style={{
                        fontSize: isMobile ? "48px" : "64px",
                        marginBottom: "1rem",
                    }}
                >
                    ❌
                </div>
                <h1
                    style={{
                        fontSize: isMobile ? "1.5rem" : "2rem",
                        fontWeight: 600,
                        color: textColor,
                        marginBottom: "0.5rem",
                        textAlign: "center",
                    }}
                >
                    {errorMessage || "Something went wrong"}
                </h1>
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        marginTop: "1rem",
                        padding: isMobile ? "12px 24px" : "16px 32px",
                        borderRadius: "8px",
                        border: "none",
                        backgroundColor: primaryColor,
                        color: buttonTextColor,
                        fontSize: isMobile ? "0.875rem" : "1rem",
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    Try Again
                </button>
            </div>
        )
    }

    // Main form rendering
    return (
        <div
            style={{
                display: "flex",
                width: "100%",
                height: "100svh",
                flexDirection: "column",
                background: backgroundColor,
                fontFamily:
                    "Lexend, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                color: textColor,
                overflow: "hidden",
                position: "relative",
            }}
        >
            <style>
                {`
                * {
                    box-sizing: border-box;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fadeOut {
                    from { opacity: 1; transform: translateY(0); }
                    to { opacity: 0; transform: translateY(-10px); }
                }
                input, textarea, select {
                    font-family: inherit;
                }
                input:focus, textarea:focus, select:focus {
                    outline: 2px solid ${primaryColor};
                    outline-offset: 2px;
                }
                footer {
                    position: relative;
                    width: 100%;
                    flex-shrink: 0;
                }
            `}
            </style>

            {/* Debug component removed for production */}

            {/* Header with progress */}
            <div style={{ flexShrink: 0 }}>
                <FormHeader
                    currentStep={currentStep}
                    totalSteps={fields.length}
                    showBackButton={
                        currentField?.hideBackButton !== undefined
                            ? !currentField.hideBackButton
                            : showBackButton
                    }
                    showProgressCount={
                        currentField?.hideProgressCount !== undefined
                            ? !currentField.hideProgressCount
                            : showProgressCount
                    }
                    onBack={handlePrevious}
                    textColor={textColor}
                    disabledColor={disabledColor}
                    canGoBack={canGoBack}
                    currentField={currentField}
                />

                {/* Progress Bar - Hide for progress process pages */}
                {currentField?.type !== "progress process" && (
                    <ProgressBar
                        currentStep={currentStep}
                        totalSteps={fields.length}
                        primaryColor={primaryColor}
                    />
                )}
            </div>

            {/* Main form content */}
            <div
                className="form-wrapper"
                style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    padding:
                        currentField?.type === "content" ||
                        currentField?.type === "progress process"
                            ? "0"
                            : isMobile
                              ? "2rem 0 0 0" // Add top padding
                              : "3rem 1.5rem 0 1.5rem", // Add top padding
                    textAlign: "center",
                    zIndex: "0",
                    minHeight: 0, // Important for flex child
                    overflowY: "auto",
                    overflowX: "clip",
                    position: "relative",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        width: "100%",
                        maxWidth: "100%",
                        minHeight: "100%",
                        flex: "1 1 auto",
                        paddingBottom: "2rem",
                        position: "relative",
                    }}
                >
                    {/* Current form page */}
                    {currentField && (
                        <>
                            {currentField.type === "content" ? (
                                <ContentPage
                                    field={currentField}
                                    onNext={handleNext}
                                    primaryColor={primaryColor}
                                    secondaryColor={secondaryColor}
                                    backgroundColor={backgroundColor}
                                    textColor={textColor}
                                    buttonTextColor={buttonTextColor}
                                />
                            ) : (
                                <FormPage
                                    field={currentField}
                                    value={formData[currentField.id]}
                                    onChange={handleInputChange}
                                    onCheckboxToggle={handleCheckboxToggle}
                                    onNext={handleNext}
                                    primaryColor={primaryColor}
                                    secondaryColor={secondaryColor}
                                    backgroundColor={backgroundColor}
                                    textColor={textColor}
                                    borderRadius={borderRadius}
                                    hideNextButton={
                                        currentField.hideNextButton || false
                                    }
                                    shouldAllowAutoAdvance={
                                        shouldAllowAutoAdvance
                                    }
                                    triggerAutoAdvance={triggerAutoAdvance}
                                    onSubmit={handleSubmit}
                                    isLastStep={isLastStep}
                                    isSubmitting={isSubmitting}
                                    submitButtonText={submitButtonText}
                                    nextButtonText={nextButtonText}
                                    buttonTextColor={buttonTextColor}
                                />
                            )}

                            {/* Show error message if validation failed */}
                            {error && (
                                <p
                                    style={{
                                        color: "#e74c3c",
                                        fontSize: isMobile
                                            ? "0.8rem"
                                            : "0.875rem",
                                        marginTop: "0.5rem",
                                        animation: "fadeIn 0.3s ease",
                                    }}
                                >
                                    This field is required
                                </p>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Footer - Now part of the flex layout */}
            {!currentField?.hideNextButton &&
                currentField?.type !== "content" &&
                currentField?.type !== "progress process" && (
                    <footer>
                        {/* Shadow */}
                        <div
                            style={{
                                height: "10rem", // Reduced from 90rem
                                width: "100%",
                                position: "absolute",
                                bottom: "100%", // Position above footer
                                left: "0px",
                                right: "0px",
                                zIndex: "-1",
                                pointerEvents: "none",
                                background:
                                    "linear-gradient(180deg, rgba(232, 178, 203, 0.00) 0%, #E8B2CB 100%)",
                            }}
                        />

                        {/* Form Button Component */}
                        <div
                            style={{
                                display: "flex",
                                padding: isMobile ? "2rem 1rem" : "3rem 1.5rem",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "0.625rem",
                                margin: "0 auto",
                                borderRadius: ".5rem 0.5rem 0rem 0rem",
                                backgroundColor: "#fff",
                                boxShadow:
                                    "0 0.1rem 0 #f6edf2, 0 0.2rem 3rem 2rem #f2e2e9",
                            }}
                        >
                            <FormButton
                                isLastStep={isLastStep}
                                isSubmitting={isSubmitting}
                                onNext={handleNext}
                                onSubmit={handleSubmit}
                                primaryColor={primaryColor}
                                buttonTextColor={buttonTextColor}
                                submitButtonText={submitButtonText}
                                nextButtonText={nextButtonText}
                                borderRadius="8px"
                            />
                        </div>
                    </footer>
                )}
        </div>
    )
}

// ===================================================================
// FRAMER PROPERTY CONTROLS
// ===================================================================

addPropertyControls(QuizForm, {
    title: {
        type: ControlType.String,
        title: "Form Title",
        defaultValue: "Multi-Step Form",
    },
    subtitle: {
        type: ControlType.String,
        title: "Form Subtitle",
        defaultValue: "Please fill out all required fields",
    },
    fields: {
        type: ControlType.Array,
        title: "Form Fields",
        defaultValue: [
            {
                id: "q1",
                question: "Have you taken antibiotics in the last 3 months?",
                subtext: "PLEASE SELECT ONE",
                type: "radio",
                options: ["Yes", "No"],
                required: true,
            },
        ],
        control: {
            type: ControlType.Object,
            controls: {
                id: {
                    type: ControlType.String,
                    title: "Field ID",
                    defaultValue: "field-1",
                },
                question: {
                    type: ControlType.String,
                    title: "Question",
                    defaultValue: "",
                    hidden: (props: any) =>
                        props.type === "progress process" ||
                        props.type === "content" ||
                        props.type === "email",
                },
                progressTitle: {
                    type: ControlType.String,
                    title: "Title",
                    defaultValue: "",
                    hidden: (props: any) => props.type !== "progress process",
                },
                subtext: {
                    type: ControlType.String,
                    title: "Subtext",
                    defaultValue: "",
                    hidden: (props: any) =>
                        props.type === "progress process" ||
                        props.type === "content" ||
                        props.type === "email",
                },
                type: {
                    type: ControlType.Enum,
                    title: "Field Type",
                    options: [
                        "text",
                        "email",
                        "number",
                        "select",
                        "radio",
                        "checkbox",
                        "textarea",
                        "progress process",
                        "content",
                    ],
                    defaultValue: "text",
                },
                options: {
                    type: ControlType.Array,
                    title: "Options",
                    control: {
                        type: ControlType.String,
                    },
                    hidden: (props: any) =>
                        !["select", "radio", "checkbox"].includes(
                            props.type as string
                        ),
                },
                required: {
                    type: ControlType.Boolean,
                    title: "Required",
                    defaultValue: false,
                },
                placeholder: {
                    type: ControlType.String,
                    title: "Placeholder",
                    defaultValue: "",
                    hidden: (props: any) =>
                        !["text", "email", "number", "textarea"].includes(
                            props.type as string
                        ),
                },
                hideNextButton: {
                    type: ControlType.Boolean,
                    title: "Hide Next Button",
                    defaultValue: false,
                },
                useConditionalLogic: {
                    type: ControlType.Boolean,
                    title: "Use Conditional Logic",
                    defaultValue: false,
                },
                conditionalRules: {
                    type: ControlType.String,
                    title: "Conditional Rules",
                    defaultValue: "",
                    description: "Format: Answer1:FieldID1,Answer2:FieldID2",
                    hidden: (props: any) => !props.useConditionalLogic,
                },
                defaultNext: {
                    type: ControlType.String,
                    title: "Default Next Field",
                    defaultValue: "",
                    description: "Field ID to go to if no condition matches",
                    hidden: (props: any) => !props.useConditionalLogic,
                },
                emailTitle: {
                    type: ControlType.String,
                    title: "Email Title",
                    defaultValue: "Email Submission",
                    hidden: (props: any) => props.type !== "email",
                },
                emailSubtext: {
                    type: ControlType.String,
                    title: "Email Subtext",
                    defaultValue: "Please enter your email address",
                    displayTextArea: true,
                    hidden: (props: any) => props.type !== "email",
                },
                emailSubmission: {
                    type: ControlType.Boolean,
                    title: "Email Submission",
                    defaultValue: false,
                    hidden: (props: any) => props.type !== "email",
                },
                emailSubmitButtonText: {
                    type: ControlType.String,
                    title: "Submit Button Text",
                    defaultValue: "Submit",
                    hidden: (props: any) => !props.emailSubmission,
                },
                useSlider: {
                    type: ControlType.Boolean,
                    title: "Use Slider",
                    defaultValue: false,
                    hidden: (props: any) => props.type !== "number",
                },
                sliderMin: {
                    type: ControlType.Number,
                    title: "Slider Min",
                    defaultValue: 0,
                    hidden: (props: any) =>
                        props.type !== "number" || !props.useSlider,
                },
                sliderMax: {
                    type: ControlType.Number,
                    title: "Slider Max",
                    defaultValue: 120,
                    hidden: (props: any) =>
                        props.type !== "number" || !props.useSlider,
                },
                sliderValue: {
                    type: ControlType.Number,
                    title: "Default Value",
                    defaultValue: 60,
                    hidden: (props: any) =>
                        props.type !== "number" || !props.useSlider,
                },
                contentComponentKey: {
                    type: ControlType.Enum,
                    title: "Content Component",
                    options: Object.keys(CustomContentComponents),
                    defaultValue: "WeGotYou",
                    hidden: (props: any) => props.type !== "content",
                },
                autoAdvanceDelay: {
                    type: ControlType.Number,
                    title: "Auto Advance Delay (ms)",
                    defaultValue: 2000,
                    min: 500,
                    max: 10000,
                    step: 100,
                    hidden: (props: any) => props.type !== "progress process",
                },
                progressSteps: {
                    type: ControlType.Array,
                    title: "Progress Steps",
                    control: {
                        type: ControlType.Object,
                        controls: {
                            id: {
                                type: ControlType.String,
                                title: "Step ID",
                                defaultValue: "step1",
                            },
                            label: {
                                type: ControlType.String,
                                title: "Step Label",
                                defaultValue: "Processing...",
                            },
                        },
                    },
                    defaultValue: [
                        { id: "step1", label: "Evaluating your answers…" },
                        { id: "step2", label: "Analyzing your results…" },
                        { id: "step3", label: "Assessing your flora balance…" },
                        { id: "step4", label: "Building your summary…" },
                    ],
                    hidden: (props: any) => props.type !== "progress process",
                },
                progressBarBgColor: {
                    type: ControlType.Color,
                    title: "Progress Bar Background",
                    defaultValue: "#E8B2CB",
                    hidden: (props: any) => props.type !== "progress process",
                },
                progressBarValueColor: {
                    type: ControlType.Color,
                    title: "Progress Bar Color",
                    defaultValue: "#632240",
                    hidden: (props: any) => props.type !== "progress process",
                },
                hideBackButton: {
                    type: ControlType.Boolean,
                    title: "Hide Back Button",
                    defaultValue: false,
                },
                hideProgressCount: {
                    type: ControlType.Boolean,
                    title: "Hide Progress Counter",
                    defaultValue: false,
                },
                includeInGtmEvent: {
                    type: ControlType.Boolean,
                    title: "Include in GTM Event",
                    defaultValue: true,
                },
            },
        },
    },
    primaryColor: {
        type: ControlType.Color,
        title: "Primary Color",
        defaultValue: "#A67C8E",
    },
    secondaryColor: {
        type: ControlType.Color,
        title: "Secondary Color",
        defaultValue: "#632240",
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background Color",
        defaultValue: "#FEFEFE",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#333333",
    },
    buttonTextColor: {
        type: ControlType.Color,
        title: "Button Text Color",
        defaultValue: "#FFFFFF",
    },
    disabledColor: {
        type: ControlType.Color,
        title: "Disabled Color",
        defaultValue: "#CCCCCC",
    },
    borderRadius: {
        type: ControlType.Number,
        title: "Border Radius",
        defaultValue: 8,
        min: 0,
        max: 50,
        unit: "px",
    },
    successMessage: {
        type: ControlType.String,
        title: "Success Message",
        defaultValue: "Thank you for your submission!",
    },
    errorMessage: {
        type: ControlType.String,
        title: "Error Message",
        defaultValue: "An error occurred. Please try again.",
    },
    submitButtonText: {
        type: ControlType.String,
        title: "Submit Button Text",
        defaultValue: "Submit",
    },
    previousButtonText: {
        type: ControlType.String,
        title: "Previous Button Text",
        defaultValue: "Previous",
    },
    nextButtonText: {
        type: ControlType.String,
        title: "Next Button Text",
        defaultValue: "Next",
    },
    showBackButton: {
        type: ControlType.Boolean,
        title: "Show Back Button",
        defaultValue: true,
    },
    showProgressCount: {
        type: ControlType.Boolean,
        title: "Show Progress Count",
        defaultValue: true,
    },
    submissionActions: {
        type: ControlType.Array,
        title: "Submission Actions",
        defaultValue: [],
        control: {
            type: ControlType.Object,
            controls: {
                id: {
                    type: ControlType.String,
                    title: "Action ID",
                    defaultValue: "action-1",
                },
                name: {
                    type: ControlType.String,
                    title: "Action Name",
                    defaultValue: "Webhook Action",
                },
                type: {
                    type: ControlType.Enum,
                    title: "Action Type",
                    options: [
                        "webhook",
                        "email",
                        "airtable",
                        "google_sheets",
                        "slack",
                        "custom",
                    ],
                    defaultValue: "webhook",
                },
                enabled: {
                    type: ControlType.Boolean,
                    title: "Enabled",
                    defaultValue: true,
                },
                order: {
                    type: ControlType.Number,
                    title: "Execution Order",
                    defaultValue: 1,
                    min: 1,
                    max: 10,
                },
                endpoint: {
                    type: ControlType.String,
                    title: "Endpoint URL",
                    defaultValue: "",
                    hidden: (props: any) =>
                        props.type === "custom" && !props.endpoint,
                },
                apiKey: {
                    type: ControlType.String,
                    title: "API Key",
                    defaultValue: "",
                    hidden: (props: any) =>
                        !["webhook", "airtable", "google_sheets"].includes(
                            props.type
                        ),
                },
                method: {
                    type: ControlType.Enum,
                    title: "HTTP Method",
                    options: ["POST", "PUT", "PATCH"],
                    defaultValue: "POST",
                    hidden: (props: any) => props.type !== "webhook",
                },
                headers: {
                    type: ControlType.String,
                    title: "Headers (JSON)",
                    defaultValue: "",
                    displayTextArea: true,
                    hidden: (props: any) => props.type !== "webhook",
                },
                emailTo: {
                    type: ControlType.String,
                    title: "Email To",
                    defaultValue: "",
                    hidden: (props: any) => props.type !== "email",
                },
                emailSubject: {
                    type: ControlType.String,
                    title: "Email Subject",
                    defaultValue: "Form Submission",
                    hidden: (props: any) => props.type !== "email",
                },
                channel: {
                    type: ControlType.String,
                    title: "Slack Channel",
                    defaultValue: "#general",
                    hidden: (props: any) => props.type !== "slack",
                },
                username: {
                    type: ControlType.String,
                    title: "Bot Username",
                    defaultValue: "Form Bot",
                    hidden: (props: any) => props.type !== "slack",
                },
                condition: {
                    type: ControlType.String,
                    title: "Condition (JS)",
                    defaultValue: "",
                    description:
                        "e.g., formData.email.includes('@company.com')",
                },
                onSuccess: {
                    type: ControlType.Enum,
                    title: "On Success",
                    options: ["continue", "stop"],
                    defaultValue: "continue",
                },
                onError: {
                    type: ControlType.Enum,
                    title: "On Error",
                    options: ["continue", "stop", "retry"],
                    defaultValue: "continue",
                },
                retryAttempts: {
                    type: ControlType.Number,
                    title: "Retry Attempts",
                    defaultValue: 1,
                    min: 1,
                    max: 5,
                    hidden: (props: any) => props.onError !== "retry",
                },
                dataMapping: {
                    type: ControlType.String,
                    title: "Data Mapping (JSON)",
                    defaultValue: "",
                    displayTextArea: true,
                    description: "Map form fields to output fields",
                },
                includeMetadata: {
                    type: ControlType.Boolean,
                    title: "Include Metadata",
                    defaultValue: false,
                },
            },
        },
    },
    executeInParallel: {
        type: ControlType.Boolean,
        title: "Execute Actions in Parallel",
        defaultValue: false,
        description: "Run all submission actions simultaneously",
    },
})

// Add a BoldText component for bold styling (if needed elsewhere)
const BoldText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <span
        style={{
            color: "#632240",
            fontFamily: "Lexend",
            fontSize: "1rem",
            fontStyle: "normal",
            fontWeight: 500,
            lineHeight: "1.5rem",
        }}
    >
        {children}
    </span>
)
