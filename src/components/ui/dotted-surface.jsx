import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

export function DottedSurface({ className, ...props }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const SEPARATION = 130;
    const AMOUNTX = 42;
    const AMOUNTY = 55;

    // ── Scene ──────────────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 10000);
    camera.position.set(0, 355, 1220);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0); // fully transparent bg

    container.appendChild(renderer.domElement);

    // ── Geometry ───────────────────────────────────────────
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const colors = [];

    // Accent color pool: electric cyan + violet + mid-blue
    const palette = [
      new THREE.Color('#00d4ff'), // electric cyan
      new THREE.Color('#9d00ff'), // deep violet
      new THREE.Color('#3b82f6'), // blue
      new THREE.Color('#14b8a6'), // teal
    ];

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
        const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;
        positions.push(x, 0, z);

        // Blend between palette colours based on grid position
        const t = (ix / AMOUNTX + iy / AMOUNTY) / 2;
        const from = palette[Math.floor(t * (palette.length - 1))];
        const to   = palette[Math.ceil(t * (palette.length - 1))];
        const blended = from.clone().lerp(to, t * (palette.length - 1) % 1);
        colors.push(blended.r, blended.g, blended.b);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 6,
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // ── Animation ──────────────────────────────────────────
    let count = 0;
    let animationId;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const posAttr = geometry.attributes.position;
      const pos = posAttr.array;

      let i = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          pos[i * 3 + 1] =
            Math.sin((ix + count) * 0.3) * 55 +
            Math.sin((iy + count) * 0.5) * 55;
          i++;
        }
      }

      posAttr.needsUpdate = true;
      renderer.render(scene, camera);
      count += 0.03;
    };

    // ── Resize ─────────────────────────────────────────────
    const handleResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);
    animate();

    sceneRef.current = { scene, camera, renderer, animationId };

    // ── Cleanup ────────────────────────────────────────────
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Points) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      {...props}
    />
  );
}
