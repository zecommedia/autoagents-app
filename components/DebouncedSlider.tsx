import React, { useState, useEffect, useRef } from 'react';

interface DebouncedSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  debounceMs?: number;
  showValue?: boolean;
  unit?: string;
  className?: string;
  color?: string;
  disabled?: boolean;
}

export const DebouncedSlider: React.FC<DebouncedSliderProps> = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  debounceMs = 300,
  showValue = true,
  unit = '',
  className = '',
  color = 'blue',
  disabled = false
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  // Update local value when external value changes (but not while adjusting)
  useEffect(() => {
    if (!isAdjusting) {
      setLocalValue(value);
    }
  }, [value, isAdjusting]);
  
  // Debounced onChange handler
  const handleChange = (newValue: number) => {
    setLocalValue(newValue);
    setIsAdjusting(true);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      onChange(newValue);
      setIsAdjusting(false);
    }, debounceMs);
  };
  
  // Immediate update on mouse up for better UX
  const handleMouseUp = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    onChange(localValue);
    setIsAdjusting(false);
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  // Format value display
  const formatValue = (val: number): string => {
    if (step >= 1) {
      return val.toFixed(0);
    } else if (step >= 0.1) {
      return val.toFixed(1);
    } else {
      return val.toFixed(2);
    }
  };
  
  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-gray-300">
          {label}
        </label>
        {showValue && (
          <span className={`text-sm font-mono transition-colors ${
            isAdjusting 
              ? 'text-yellow-400 font-semibold' 
              : 'text-gray-400'
          }`}>
            {formatValue(localValue)}{unit}
            {isAdjusting && <span className="ml-1 animate-pulse">●</span>}
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localValue}
        disabled={disabled}
        onChange={(e) => handleChange(Number(e.target.value))}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        className={`w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-${color}-500 transition-all ${
          isAdjusting ? 'ring-2 ring-yellow-400/50 ring-offset-2 ring-offset-gray-900' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-600'}`}
      />
    </div>
  );
};

export default DebouncedSlider;
