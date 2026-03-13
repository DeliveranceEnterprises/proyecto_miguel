import React, { useState, useEffect } from 'react';
import { Box, Button, NumberInput, NumberInputField, NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper } from "@chakra-ui/react";
import { Blueprint3DAppRef } from './Blueprint3DApp';

interface PredictionPanelProps {
    isVisible: boolean;
    hasSelectedItem?: boolean;
}

export default function PredictionPanel({ isVisible, hasSelectedItem }: PredictionPanelProps) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [weeks, setWeeks] = useState<number>(1);

    useEffect(() => {
        if (hasSelectedItem) {
            setIsCollapsed(true);
        }
    }, [hasSelectedItem]);

    if (!isVisible) return null;

    const handlePredict = () => {
        console.log(`Predicting for ${weeks} weeks...`);
        // Aqui irá la llamada a la ruta futura predict_week 
        // const response = await fetch(\`/api/v1/prediction/predict_week?weeks=\${weeks}\`);
    };

    return (
        <div
            style={{
                width: isCollapsed ? 48 : 280,
                display: 'flex',
                flexDirection: 'column',
                animation: 'panelSlideIn 0.3s ease forwards',
                transition: 'width 0.3s ease',
                pointerEvents: 'auto',
                flexShrink: 0,
            }}
        >
            {/* Panel header */}
            <div
                style={{
                    background: 'rgba(15,23,42,0.85)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(167, 139, 250, 0.3)',
                    borderRadius: isCollapsed ? 12 : '12px 12px 0 0',
                    padding: isCollapsed ? '10px' : '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'space-between',
                    gap: 8,
                    boxShadow: '0 0 24px rgba(167, 139, 250, 0.15)',
                    flexShrink: 0,
                    cursor: 'pointer',
                }}
                onClick={() => setIsCollapsed((c) => !c)}
                title={isCollapsed ? 'Expandir panel de predicción' : 'Colapsar panel de predicción'}
            >
                {!isCollapsed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                            style={{
                                width: 28,
                                height: 28,
                                borderRadius: 8,
                                background: 'linear-gradient(135deg, #8B5CF6, #C084FC)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)',
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                        </div>
                        <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#F1F5F9', letterSpacing: '0.02em' }}>
                                Predicción de Tareas
                            </div>
                        </div>
                    </div>
                )}

                {isCollapsed && (
                    <div
                        style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: 'linear-gradient(135deg, #8B5CF6, #C084FC)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 10px rgba(139, 92, 246, 0.5)',
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                    </div>
                )}
            </div>

            {/* Panel body */}
            {!isCollapsed && (
                <div
                    style={{
                        background: 'rgba(10,18,35,0.8)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(167, 139, 250, 0.15)',
                        borderTop: 'none',
                        borderRadius: '0 0 12px 12px',
                        padding: 14,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}
                >
                    <Box mb={3}>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'rgba(148,163,184,0.7)', textTransform: 'uppercase', marginBottom: 4 }}>
                            Número de semanas
                        </label>
                        <NumberInput size="sm" min={1} max={52} value={weeks} onChange={(valueAsString: string, valueAsNumber: number) => setWeeks(isNaN(valueAsNumber) ? 1 : valueAsNumber)}
                            bg="rgba(255,255,255,0.05)" color="white" borderColor="rgba(255,255,255,0.1)" borderRadius="md">
                            <NumberInputField _hover={{ borderColor: "rgba(167, 139, 250, 0.5)" }} _focus={{ borderColor: "#8B5CF6", boxShadow: "0 0 0 1px #8B5CF6" }} />
                            <NumberInputStepper borderColor="rgba(255,255,255,0.1)">
                                <NumberIncrementStepper color="white" _active={{ bg: "rgba(255,255,255,0.1)" }} />
                                <NumberDecrementStepper color="white" _active={{ bg: "rgba(255,255,255,0.1)" }} />
                            </NumberInputStepper>
                        </NumberInput>
                    </Box>
                    <Button
                        size="sm"
                        width="full"
                        bg="linear-gradient(135deg, #8B5CF6, #C084FC)"
                        color="white"
                        _hover={{ opacity: 0.9, transform: 'translateY(-1px)' }}
                        _active={{ transform: 'none' }}
                        onClick={handlePredict}
                    >
                        Predecir
                    </Button>
                </div>
            )}
        </div>
    );
}
