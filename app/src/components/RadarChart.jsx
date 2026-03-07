/**
 * Reusable 4-axis radar chart rendered as SVG.
 * skills: [{ label, value }]  – value 0–10, in order: top, right, bottom, left
 */
export default function RadarChart({ skills, size = 280, color = '#0D9488', animated = true }) {
    // Diamond radar: 4 axes at 0°(top), 90°(right), 180°(bottom), 270°(left)
    const cx = size / 2
    const cy = size / 2
    const maxR = (size / 2) * 0.72   // usable radius

    // Four axis directions: top, right, bottom, left
    const AXES = [
        { angle: -90 },  // top
        { angle: 0 },    // right
        { angle: 90 },   // bottom
        { angle: 180 },  // left
    ]

    function toXY(angle, r) {
        const rad = (angle * Math.PI) / 180
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
    }

    function skillPoints(vals) {
        return vals.map((v, i) => {
            const r = (Math.min(Math.max(v, 0), 10) / 10) * maxR
            return toXY(AXES[i].angle, r)
        })
    }

    // Grid rings at 25%, 50%, 75%, 100%
    const gridRings = [0.25, 0.5, 0.75, 1.0].map(pct => {
        const r = pct * maxR
        const pts = AXES.map(ax => toXY(ax.angle, r))
        return pts.map(p => `${p.x},${p.y}`).join(' ')
    })

    const values = skills.map(s => s.value)
    const dataPoints = skillPoints(values)
    const dataPolygon = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

    // Axis endpoints (100%)
    const axisEnds = AXES.map(ax => toXY(ax.angle, maxR))

    // Label positions (110% of maxR)
    const labelPts = AXES.map((ax, i) => ({
        ...toXY(ax.angle, maxR * 1.22),
        label: skills[i]?.label || '',
        value: skills[i]?.value ?? 0,
    }))

    return (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="overflow-visible"
            style={{ display: 'block' }}
        >
            {/* Grid rings */}
            {gridRings.map((pts, i) => (
                <polygon key={i} points={pts} fill="none" stroke="#e2e8f0" strokeWidth="1" className="dark:stroke-slate-700" />
            ))}

            {/* Axes */}
            {axisEnds.map((pt, i) => (
                <line key={i} x1={cx} y1={cy} x2={pt.x} y2={pt.y} stroke="#e2e8f0" strokeWidth="1" className="dark:stroke-slate-700" />
            ))}

            {/* Data polygon */}
            <polygon
                points={dataPolygon}
                fill={`${color}26`}
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
                style={animated ? { transition: 'points 0.6s ease' } : {}}
            />

            {/* Data dots */}
            {dataPoints.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={4} fill={color} />
            ))}

            {/* Labels */}
            {labelPts.map((pt, i) => {
                const isRight = i === 1
                const isLeft = i === 3
                const anchor = isRight ? 'start' : isLeft ? 'end' : 'middle'
                return (
                    <g key={i}>
                        <text
                            x={pt.x}
                            y={pt.y - 6}
                            textAnchor={anchor}
                            fontSize="10"
                            fontWeight="600"
                            fill="#475569"
                            className="dark:fill-slate-400"
                        >
                            {pt.label}
                        </text>
                        <text
                            x={pt.x}
                            y={pt.y + 8}
                            textAnchor={anchor}
                            fontSize="10"
                            fill={color}
                            fontWeight="700"
                        >
                            {pt.value.toFixed(1)}
                        </text>
                    </g>
                )
            })}
        </svg>
    )
}
