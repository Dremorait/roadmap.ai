import { useState, useEffect, useRef } from "react";
import { ArrowRight, Link, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RadialOrbitalTimeline({ timelineData }) {
  const [expandedItems, setExpandedItems] = useState({});
  const [rotationAngle, setRotationAngle] = useState(0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [pulseEffect, setPulseEffect] = useState({});
  const [centerOffset] = useState({ x: 0, y: 0 });
  const [activeNodeId, setActiveNodeId] = useState(null);
  const containerRef = useRef(null);
  const orbitRef = useRef(null);
  const nodeRefs = useRef({});

  const handleContainerClick = (e) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const getRelatedItems = (itemId) => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const centerViewOnNode = (nodeId) => {
    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;
    setRotationAngle(270 - targetAngle);
  };

  const toggleItem = (id) => {
    setExpandedItems((prev) => {
      const newState = { ...prev };
      Object.keys(newState).forEach((key) => {
        if (parseInt(key) !== id) newState[parseInt(key)] = false;
      });
      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const relatedItems = getRelatedItems(id);
        const newPulseEffect = {};
        relatedItems.forEach((relId) => { newPulseEffect[relId] = true; });
        setPulseEffect(newPulseEffect);
        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }

      return newState;
    });
  };

  useEffect(() => {
    let rotationTimer;
    if (autoRotate) {
      rotationTimer = setInterval(() => {
        setRotationAngle((prev) => Number(((prev + 0.3) % 360).toFixed(3)));
      }, 50);
    }
    return () => { if (rotationTimer) clearInterval(rotationTimer); };
  }, [autoRotate]);

  const calculateNodePosition = (index, total) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 200;
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian) + centerOffset.x;
    const y = radius * Math.sin(radian) + centerOffset.y;
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(0.4, Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2)));
    return { x, y, angle, zIndex, opacity };
  };

  const isRelatedToActive = (itemId) => {
    if (!activeNodeId) return false;
    return getRelatedItems(activeNodeId).includes(itemId);
  };

  const getStatusStyles = (status) => {
    switch (status) {
      case "completed": return "text-white bg-black border-white";
      case "in-progress": return "text-black bg-white border-black";
      case "pending": return "text-white bg-black/40 border-white/50";
      default: return "text-white bg-black/40 border-white/50";
    }
  };

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
        <div
          className="absolute w-full h-full flex items-center justify-center"
          ref={orbitRef}
          style={{
            perspective: "1000px",
            transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)`,
          }}
        >
          {/* Center orb */}
          <div className="absolute w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-teal-500 animate-pulse flex items-center justify-center z-10">
            <div className="absolute w-20 h-20 rounded-full border border-white/20 animate-ping opacity-70"></div>
            <div
              className="absolute w-24 h-24 rounded-full border border-white/10 animate-ping opacity-50"
              style={{ animationDelay: "0.5s" }}
            ></div>
            <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-md"></div>
          </div>

          {/* Orbit ring */}
          <div className="absolute w-96 h-96 rounded-full border border-white/10"></div>

          {/* Nodes */}
          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;

            return (
              <div
                key={item.id}
                ref={(el) => (nodeRefs.current[item.id] = el)}
                className="absolute transition-all duration-700 cursor-pointer"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px)`,
                  zIndex: isExpanded ? 200 : position.zIndex,
                  opacity: isExpanded ? 1 : position.opacity,
                }}
                onClick={(e) => { e.stopPropagation(); toggleItem(item.id); }}
              >
                {/* Energy glow */}
                <div
                  className={`absolute rounded-full -inset-1 ${isPulsing ? "animate-pulse" : ""}`}
                  style={{
                    background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 70%)",
                    width: `${item.energy * 0.5 + 40}px`,
                    height: `${item.energy * 0.5 + 40}px`,
                    left: `-${(item.energy * 0.5 + 40 - 40) / 2}px`,
                    top: `-${(item.energy * 0.5 + 40 - 40) / 2}px`,
                  }}
                />

                {/* Icon circle */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${isExpanded ? "bg-white text-black" : isRelated ? "bg-white/50 text-black" : "bg-black text-white"}
                    border-2
                    ${isExpanded ? "border-white shadow-lg shadow-white/30" : isRelated ? "border-white animate-pulse" : "border-white/40"}
                    transition-all duration-300 transform
                    ${isExpanded ? "scale-150" : ""}
                  `}
                >
                  <Icon size={16} />
                </div>

                {/* Label */}
                <div
                  className={`
                    absolute top-12 whitespace-nowrap text-xs font-semibold tracking-wider
                    transition-all duration-300
                    ${isExpanded ? "text-white scale-125" : "text-white/70"}
                  `}
                  style={{ left: "50%", transform: isExpanded ? "translateX(-50%) scale(1.25)" : "translateX(-50%)" }}
                >
                  {item.title}
                </div>

                {/* Expanded card */}
                {isExpanded && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '4rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '320px',
                      background: 'rgba(10, 10, 10, 0.95)',
                      backdropFilter: 'blur(24px)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '16px',
                      boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px rgba(0,0,0,0.6), 0 0 40px rgba(255,255,255,0.04)',
                      overflow: 'hidden',
                      zIndex: 300,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Connector line */}
                    <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', width: '1px', height: '14px', background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.4))' }} />

                    {/* Top accent bar */}
                    <div style={{ height: '2px', background: 'linear-gradient(90deg, #6366f1, #3b82f6, #14b8a6)', borderRadius: '16px 16px 0 0' }} />

                    {/* Header */}
                    <div style={{ padding: '1.1rem 1.25rem 0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                        {/* Status badge */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          background: item.status === 'completed' ? 'rgba(20,184,166,0.15)' : item.status === 'in-progress' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)',
                          border: `1px solid ${item.status === 'completed' ? 'rgba(20,184,166,0.35)' : item.status === 'in-progress' ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.12)'}`,
                        }}>
                          <div style={{
                            width: '5px', height: '5px', borderRadius: '50%',
                            background: item.status === 'completed' ? '#14b8a6' : item.status === 'in-progress' ? '#6366f1' : 'rgba(255,255,255,0.4)',
                            boxShadow: item.status === 'completed' ? '0 0 6px #14b8a6' : item.status === 'in-progress' ? '0 0 6px #6366f1' : 'none',
                          }} />
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: item.status === 'completed' ? '#14b8a6' : item.status === 'in-progress' ? '#818cf8' : 'rgba(255,255,255,0.4)' }}>
                            {item.status === 'completed' ? 'Complete' : item.status === 'in-progress' ? 'In Progress' : 'Pending'}
                          </span>
                        </div>
                        {/* Date */}
                        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace', letterSpacing: '0.02em' }}>{item.date}</span>
                      </div>

                      {/* Title */}
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', lineHeight: 1.35, margin: 0 }}>{item.title}</h3>
                    </div>

                    {/* Divider */}
                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 1.25rem' }} />

                    {/* Body */}
                    <div style={{ padding: '0.85rem 1.25rem 1.1rem' }}>
                      {/* Content text */}
                      <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: '0 0 1rem' }}>{item.content}</p>

                      {/* Energy bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.45rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            <Zap size={11} style={{ color: '#818cf8' }} />
                            Energy Level
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', color: item.energy >= 75 ? '#14b8a6' : item.energy >= 40 ? '#818cf8' : 'rgba(255,255,255,0.4)' }}>
                            {item.energy}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.07)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${item.energy}%`,
                              borderRadius: '999px',
                              background: 'linear-gradient(90deg, #6366f1, #3b82f6, #14b8a6)',
                              boxShadow: '0 0 8px rgba(99,102,241,0.5)',
                              transition: 'width 0.6s ease',
                            }}
                          />
                        </div>
                      </div>

                      {/* Related nodes */}
                      {item.relatedIds.length > 0 && (
                        <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.6rem' }}>
                            <Link size={11} style={{ color: 'rgba(255,255,255,0.35)' }} />
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Connected Nodes</span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {item.relatedIds.map((relatedId) => {
                              const relatedItem = timelineData.find((i) => i.id === relatedId);
                              return (
                                <button
                                  key={relatedId}
                                  onClick={(e) => { e.stopPropagation(); toggleItem(relatedId); }}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                                    padding: '0.3rem 0.65rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(99,102,241,0.25)',
                                    background: 'rgba(99,102,241,0.08)',
                                    color: '#a5b4fc',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.18)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)'; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'; }}
                                >
                                  {relatedItem?.title}
                                  <ArrowRight size={9} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
