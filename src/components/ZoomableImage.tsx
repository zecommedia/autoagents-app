import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface ZoomableImageProps {
    src: string;
    className?: string;
    preserveZoomOnSrcUpdate?: boolean;
    disablePan?: boolean;
}

const ZoomableImage = forwardRef<{ resetZoom: () => void }, ZoomableImageProps>(({ src, className, preserveZoomOnSrcUpdate = false, disablePan = false }, ref) => {
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
        resetZoom: () => {
            setZoom(1);
            setOffset({ x: 0, y: 0 });
        }
    }));

    useEffect(() => {
        if (preserveZoomOnSrcUpdate) {
            return;
        }
        setZoom(1);
        setOffset({ x: 0, y: 0 });
    }, [src, preserveZoomOnSrcUpdate]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleAmount = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.1, zoom + scaleAmount);
        
        if (containerRef.current && imageRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const image = imageRef.current;

            // Mouse position relative to container
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate the point on the image that the mouse is over
            const imageX = (mouseX - offset.x) / zoom;
            const imageY = (mouseY - offset.y) / zoom;

            // Calculate new offset to keep the point under the mouse
            const newOffsetX = mouseX - imageX * newZoom;
            const newOffsetY = mouseY - imageY * newZoom;
            
            setZoom(newZoom);
            setOffset({ x: newOffsetX, y: newOffsetY });
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (disablePan) return; // Don't pan if disabled
        if (e.button !== 0) return; // Only pan with left-click
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    };

    const handleMouseUp = () => {
        if (disablePan) return;
        setIsPanning(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (disablePan || !isPanning) return;
        e.preventDefault();
        const newOffsetX = e.clientX - panStartRef.current.x;
        const newOffsetY = e.clientY - panStartRef.current.y;
        setOffset({ x: newOffsetX, y: newOffsetY });
    };

    const handleMouseLeave = () => {
        if (disablePan) return;
        setIsPanning(false);
    };

    return (
        <div
            ref={containerRef}
            className={`relative overflow-hidden ${className}`}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ 
                cursor: disablePan ? 'inherit' : (isPanning ? 'grabbing' : 'grab'),
                width: '100%',
                height: '100%'
            }}
        >
            <img
                ref={imageRef}
                src={src}
                className="absolute"
                style={{
                    transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    transformOrigin: '0 0',
                    transition: 'none',
                    maxWidth: 'none',
                    maxHeight: 'none',
                    objectFit: 'contain',
                }}
                draggable="false"
                alt="Zoomable content"
            />
        </div>
    );
});

export default ZoomableImage;
