import { cn } from '@/lib/utils';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'>;

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    particles: THREE.Points[];
    animationId: number;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Detect mobile for performance optimization
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

    // Responsive configuration
    const SEPARATION = isMobile ? 100 : isTablet ? 125 : 150;
    const AMOUNTX = isMobile ? 20 : isTablet ? 30 : 40;
    const AMOUNTY = isMobile ? 30 : isTablet ? 45 : 60;

    // Scene setup with blue fog color (sistema azul escuro)
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1a2332, 2000, 10000);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      10000,
    );
    camera.position.set(0, 355, 1220);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: !isMobile, // Disable antialiasing on mobile for performance
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap pixel ratio for performance
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(scene.fog.color, 0);

    containerRef.current.appendChild(renderer.domElement);

    // Create particles
    const particles: THREE.Points[] = [];
    const positions: number[] = [];
    const colors: number[] = [];

    // Sistema blue colors in RGB
    const primaryBlue = { r: 104, g: 182, b: 229 }; // hsl(201 60% 66%)
    const glowBlue = { r: 123, g: 195, b: 238 }; // hsl(201 65% 75%)

    // Create geometry for all particles
    const geometry = new THREE.BufferGeometry();

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
        const y = 0; // Will be animated
        const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;

        positions.push(x, y, z);
        
        // Gradient from primary blue to glow blue
        const blend = (ix + iy) / (AMOUNTX + AMOUNTY);
        const r = primaryBlue.r + (glowBlue.r - primaryBlue.r) * blend;
        const g = primaryBlue.g + (glowBlue.g - primaryBlue.g) * blend;
        const b = primaryBlue.b + (glowBlue.b - primaryBlue.b) * blend;
        
        colors.push(r, g, b);
      }
    }

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Create material with blue tones
    const material = new THREE.PointsMaterial({
      size: isMobile ? 6 : 8,
      vertexColors: true,
      transparent: true,
      opacity: 0.7, // More visible particles
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending, // Add glow effect
    });

    // Create points object
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let count = 0;
    let animationId: number;

    // Animation function
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const positionAttribute = geometry.attributes.position;
      const positions = positionAttribute.array as Float32Array;

      let i = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          const index = i * 3;

          // Animate Y position with sine waves (smoother animation)
          positions[index + 1] =
            Math.sin((ix + count) * 0.3) * 50 +
            Math.sin((iy + count) * 0.5) * 50;

          i++;
        }
      }

      positionAttribute.needsUpdate = true;

      renderer.render(scene, camera);
      count += 0.08; // Slower animation for smoother effect
    };

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Start animation
    animate();

    // Store references
    sceneRef.current = {
      scene,
      camera,
      renderer,
      particles: [points],
      animationId,
      count,
    };

    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);

      if (sceneRef.current) {
        cancelAnimationFrame(sceneRef.current.animationId);

        // Clean up Three.js objects
        sceneRef.current.scene.traverse((object) => {
          if (object instanceof THREE.Points) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });

        sceneRef.current.renderer.dispose();

        if (containerRef.current && sceneRef.current.renderer.domElement) {
          containerRef.current.removeChild(
            sceneRef.current.renderer.domElement,
          );
        }
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none fixed inset-0 -z-10', className)}
      {...props}
    />
  );
}
