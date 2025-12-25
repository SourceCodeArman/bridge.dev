import { useEffect, useRef } from 'react';

interface Point {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
}

export function AuthBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Configuration
        const POINT_COUNT = 40;
        const CONNECTION_DISTANCE = 150;
        const POINT_SPEED = 0.5;
        const POINT_SIZE = 4;

        let width = 0;
        let height = 0;
        const points: Point[] = [];

        // Resize handler
        const handleResize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                width = parent.clientWidth;
                height = parent.clientHeight;
                canvas.width = width;
                canvas.height = height;
            }
        };

        // Initialize points
        const initPoints = () => {
            points.length = 0;
            for (let i = 0; i < POINT_COUNT; i++) {
                points.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: (Math.random() - 0.5) * POINT_SPEED,
                    vy: (Math.random() - 0.5) * POINT_SPEED,
                    size: Math.random() * 2 + POINT_SIZE
                });
            }
        };

        // Animation loop
        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, width, height);

            // Update and draw points
            points.forEach((point, i) => {
                // Move point
                point.x += point.vx;
                point.y += point.vy;

                // Bounce off edges
                if (point.x < 0 || point.x > width) point.vx *= -1;
                if (point.y < 0 || point.y > height) point.vy *= -1;

                // Draw point (box)
                ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'; // Using a primary-like blue (can be updated to match exact accent if converted to RGB)
                // Actually, let's use the exact accent color converted roughly to RGB for canvas
                // oklch(0.5206 0.1048 233.25) is approx #2563eb (blue-600)
                ctx.fillStyle = 'rgba(37, 99, 235, 0.4)';
                ctx.fillRect(point.x - point.size / 2, point.y - point.size / 2, point.size, point.size);

                // Connect to nearby points
                for (let j = i + 1; j < points.length; j++) {
                    const other = points[j];
                    if (!other) continue;
                    const dx = point.x - other.x;
                    const dy = point.y - other.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < CONNECTION_DISTANCE) {
                        const opacity = (1 - distance / CONNECTION_DISTANCE) * 0.3;
                        ctx.strokeStyle = `rgba(37, 99, 235, ${opacity})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.moveTo(point.x, point.y);
                        ctx.lineTo(other.x, other.y);
                        ctx.stroke();
                    }
                }
            });

            requestAnimationFrame(animate);
        };

        // Setup
        handleResize();
        initPoints();
        window.addEventListener('resize', handleResize);
        const animationId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
        />
    );
}
