// Lightweight shim for Framer APIs used by components in this sandbox
// This allows importing { addPropertyControls, ControlType } from "framer"

export const ControlType = {
  String: "String",
  Number: "Number",
  Boolean: "Boolean",
  Color: "Color",
  Enum: "Enum",
  Array: "Array",
  Object: "Object",
} as const

export type ControlType = typeof ControlType[keyof typeof ControlType]

type PropertyControls = Record<string, any>

export function addPropertyControls(component: any, controls: PropertyControls): void {
  try {
    Object.defineProperty(component, "__propertyControls", {
      value: controls,
      enumerable: false,
      configurable: true,
      writable: true,
    })
  } catch (_) {
    // Fallback assignment if defineProperty fails
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    component.__propertyControls = controls
  }
}

// Optional, basic placeholder types to avoid import errors in some components
export type PropertyControl = {
  type: ControlType
  title?: string
  defaultValue?: unknown
  options?: string[]
  control?: unknown
  hidden?: (props: any) => boolean
  description?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  displayTextArea?: boolean
}

// In Framer, components sometimes expect runtime to read controls back
export function getPropertyControls(component: any): PropertyControls | undefined {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return component && component.__propertyControls
}
