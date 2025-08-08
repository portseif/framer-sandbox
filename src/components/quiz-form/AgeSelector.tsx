import React, { useState, useEffect } from "react"
import { motion, useMotionValue, PanInfo } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

interface Props {
    value: number
    minAge?: number
    maxAge?: number
    width?: number
    height?: number
    onChange?: (age: number) => void
}

export default function AgeSelector(props: Props) {
    // Destructure props with defaults
    const {
        value,
        minAge = 0,
        maxAge = 100,
        width = 358,
        height = 178,
        onChange,
    } = props

    // Only maintain dragging state, not age state
    const x = useMotionValue(0)
    const [isDragging, setIsDragging] = useState(false)
    const [tempAgeOffset, setTempAgeOffset] = useState(0)

    // Use value prop directly as the age
    const age = isDragging ? value + tempAgeOffset : value

    // Configuration with exact dimensions
    const tickSpacing = 12 // 0.75rem = 12px
    const isMobile = width < 340 // Mobile vs desktop/tablet detection

    // Generate tick marks for infinite scrolling
    const generateTicks = () => {
        const ticks = []
        // Create 3 full cycles for smooth infinite scrolling
        for (let cycle = -1; cycle <= 1; cycle++) {
            for (let i = minAge; i <= maxAge; i++) {
                ticks.push({
                    age: i,
                    cycleOffset: cycle * (maxAge - minAge + 1),
                    actualAge: i,
                })
            }
        }
        return ticks
    }

    // Handle drag start
    const handleDragStart = () => {
        setIsDragging(true)
        setTempAgeOffset(0)
    }

    // Handle drag end to snap to nearest age
    const handleDragEnd = (event: any, info: PanInfo) => {
        const offset = info.offset.x
        const velocity = info.velocity.x

        // Calculate tick movement
        const ticksMoved = -Math.round(offset / tickSpacing)

        // Calculate new age with momentum
        let newAge = value + ticksMoved
        const momentumTicks = -Math.round(velocity / 2000)
        newAge = newAge + momentumTicks

        // Handle wrapping for infinite scroll
        const range = maxAge - minAge + 1
        if (newAge > maxAge) {
            newAge = minAge + ((newAge - minAge) % range)
        } else if (newAge < minAge) {
            newAge = maxAge - ((minAge - newAge - 1) % range)
        }

        // Reset dragging state and call onChange
        setIsDragging(false)
        setTempAgeOffset(0)

        // Only call onChange if the value actually changed
        if (onChange && newAge !== value) {
            onChange(newAge)
        }
    }

    const ticks = generateTicks()
    const centerCycleStartIndex = maxAge - minAge + 1 // Start of middle cycle
    const currentAgeIndex = centerCycleStartIndex + (age - minAge)

    return (
        <div
            style={{
                width: isMobile ? 327 : width,
                height: height,
                position: "relative",
                background: "transparent",
                borderRadius: "0px",
                fontFamily:
                    "Lexend, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                userSelect: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0",
                overflow: "hidden",
                margin: "0 auto",
            }}
        >
            {/* Age Display */}
            <div
                style={{
                    fontFamily: "Lexend",
                    textAlign: "center",
                    marginBottom: "20px",
                    display: "flex",
                    placeItems: "baseline",
                    gap: "0.8rem",
                }}
            >
                <motion.div
                    key={age}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{
                        fontSize: "48px",
                        fontWeight: 400, // Regular weight to match SVG
                        color: "#632240",
                        lineHeight: 1,
                    }}
                >
                    {age}
                </motion.div>
                <div
                    style={{
                        fontFamily: "Lexend",
                        fontSize: "24px",
                        fontWeight: 400,
                        color: "#632240",
                        letterSpacing: "0.5px",
                    }}
                >
                    years
                </div>
            </div>

            {/* Ruler Section */}
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: "100px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                }}
            >
                {/* Pointer - Elegant design with thin stem */}
                <svg
                    style={{
                        position: "absolute",
                        top: "0px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 10,
                    }}
                    width="28"
                    height="100"
                    viewBox="0 0 28 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path
                        d="M14 0C15.105 0 16 0.895 16 2V85.428L28 100H0L12 85.428V2C12 0.895 12.895 0 14 0Z"
                        fill="#632240"
                    />
                </svg>

                {/* Ruler Container */}
                <div
                    style={{
                        position: "relative",
                        height: "76px",
                        width: "100%",
                        overflow: "hidden",
                        cursor: "grab",
                        mask: "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
                        WebkitMask:
                            "linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)",
                    }}
                >
                    {/* Draggable Ruler */}
                    <motion.div
                        style={{
                            position: "absolute",
                            height: "100%",
                            width: `${ticks.length * tickSpacing}px`,
                            left: 0,
                            top: 0,
                            x: isDragging
                                ? x
                                : (isMobile ? 327 : width) / 2 -
                                  currentAgeIndex * tickSpacing,
                        }}
                        drag="x"
                        dragElastic={0.2}
                        dragMomentum={false}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        whileTap={{ cursor: "grabbing" }}
                        transition={
                            isDragging
                                ? { type: false }
                                : {
                                      type: "spring",
                                      stiffness: 400,
                                      damping: 40,
                                  }
                        }
                    >
                        {ticks.map((tick, index) => {
                            const tickAge = tick.actualAge
                            const isCurrentAge =
                                tickAge === age && tick.cycleOffset === 0
                            const isMajorTick = tickAge % 10 === 0
                            const isMediumTick =
                                tickAge % 5 === 0 && !isMajorTick

                            // Tick heights matching the design
                            let tickHeight = 16 // minor tick height
                            if (isMajorTick) {
                                tickHeight = 40 // major tick height (every 10)
                            } else if (isMediumTick) {
                                tickHeight = 32 // medium tick height (every 5)
                            }

                            return (
                                <div
                                    key={`${tick.cycleOffset}-${tickAge}`}
                                    style={{
                                        position: "absolute",
                                        top: "0px",
                                        left: `${index * tickSpacing}px`,
                                    }}
                                >
                                    {/* Tick mark */}
                                    <div
                                        style={{
                                            width: "1px",
                                            height: `${tickHeight}px`,
                                            background: isCurrentAge
                                                ? "#632240"
                                                : "#E8B2CB",
                                            borderRadius: "0.5px",
                                            transition: "all 0.2s ease",
                                        }}
                                    />
                                    {/* Number labels for major and medium ticks */}
                                    {isMajorTick && (
                                        <div
                                            style={{
                                                fontSize: "14px",
                                                fontWeight: 400,
                                                color: "#E8B2CB",
                                                textAlign: "center",
                                                margin: "6px auto",
                                                transform: "translateX(-50%)",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {tickAge}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </motion.div>
                </div>

                {/* Bottom baseline */}
                <div
                    style={{
                        position: "absolute",
                        bottom: "0px",
                        left: "0",
                        right: "0",
                        height: "1px",
                        background: "#632240",
                    }}
                />
            </div>
        </div>
    )
}

// Framer property controls
addPropertyControls(AgeSelector, {
    value: {
        type: ControlType.Number,
        title: "Age Value",
        defaultValue: 30,
        min: 0,
        max: 100,
        step: 1,
    },
    minAge: {
        type: ControlType.Number,
        title: "Minimum Age",
        defaultValue: 0,
        min: 0,
        max: 100,
        step: 1,
    },
    maxAge: {
        type: ControlType.Number,
        title: "Maximum Age",
        defaultValue: 100,
        min: 1,
        max: 120,
        step: 1,
    },
})

// Default props with exact dimensions
AgeSelector.defaultProps = {
    value: 30,
    minAge: 0,
    maxAge: 100,
    width: 358, // 22.375rem for desktop/tablet
    height: 178, // 11.125rem
}
