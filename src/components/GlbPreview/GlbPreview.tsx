import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type GlbPreviewProps = {
  /** URL pública del glb, por ejemplo "/assets/models/bellabotkerfus.glb" */
  url: string;
  /** Alto del visor */
  height?: number;
};

export default function GlbPreview({ url, height = 420 }: GlbPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- Scene / Camera / Renderer ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2f2f2);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );
    camera.position.set(2, 2, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // --- Lights ---
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 10, 7.5);
    scene.add(dir);

    // --- Load GLB ---
    const loader = new GLTFLoader();

    let model: THREE.Object3D | null = null;

    loader.load(
      url,
      (gltf) => {
        model = gltf.scene;

        // Centrar el modelo (para que orbite bien)
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);

        // Escala automática para que quede a un tamaño “cómodo” en el visor
        const maxAxis = Math.max(size.x, size.y, size.z);
        const desired = 1.2; // “tamaño objetivo” visual
        const s = desired / (maxAxis || 1);
        model.scale.setScalar(s);

        scene.add(model);
        controls.update();
      },
      undefined,
      (error) => {
        console.error("Error cargando GLB:", error);
      }
    );

    // --- Resize ---
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    // --- Render loop ---
    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Cleanup ---
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);

      controls.dispose();

      // Liberar geometrías/materiales si había modelo
      if (model) {
        model.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose?.();
            const mat = mesh.material as any;
            if (Array.isArray(mat)) mat.forEach((m) => m?.dispose?.());
            else mat?.dispose?.();
          }
        });
      }

      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [url]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height,
        borderRadius: 12,
        overflow: "hidden",
      }}
    />
  );
}
