import { useRef, useState, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";

function buildModel() {
  const m = tf.sequential();
  m.add(tf.layers.conv2d({ inputShape: [28, 28, 1], filters: 32, kernelSize: 3, activation: "relu" }));
  m.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  m.add(tf.layers.conv2d({ filters: 64, kernelSize: 3, activation: "relu" }));
  m.add(tf.layers.maxPooling2d({ poolSize: 2 }));
  m.add(tf.layers.flatten());
  m.add(tf.layers.dense({ units: 128, activation: "relu" }));
  m.add(tf.layers.dropout({ rate: 0.3 }));
  m.add(tf.layers.dense({ units: 10, activation: "softmax" }));
  return m;
}

async function loadModel() {
  const [meta, buf] = await Promise.all([
    fetch("/cnn/meta.json").then((r) => r.json()),
    fetch("/cnn/weights.bin").then((r) => r.arrayBuffer()),
  ]);
  const floats = new Float32Array(buf);
  let offset = 0;
  const tensors = meta.map(({ shape }) => {
    const size = shape.reduce((a, b) => a * b, 1);
    const t = tf.tensor(floats.slice(offset, offset + size), shape);
    offset += size;
    return t;
  });
  const model = buildModel();
  model.setWeights(tensors);
  return model;
}

export default function App() {
  const canvasRef = useRef(null);
  const previewRef = useRef(null);
  const [model, setModel] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [confidences, setConfidences] = useState([]);
  const isDrawing = useRef(false);

useEffect(() => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}, []);

//   useEffect(() => {
//     tf.loadLayersModel("/tfjs_model/model.json")
//       .then((m) => {
//         console.log("Model loaded successfully");
//         setModel(m);
//       })
//       // .catch((err) => {
//       //   console.error("Model failed to load:", err);
//       // });
//       .catch((err) => {
//       console.error("Model failed to load - message:", err?.message);
//       console.error("Model failed to load - full:", err);
// });
//   }, []);

  // useEffect(() => {
  //   const canvas = canvasRef.current;
  //   const ctx = canvas.getContext("2d");
  //   ctx.fillStyle = "black";
  //   ctx.fillRect(0, 0, canvas.width, canvas.height);
  //   ctx.strokeStyle = "white";
  //   ctx.lineWidth = 18;
  //   ctx.lineCap = "round";
  // }, []);

  useEffect(() => {
  loadModel()
    .then((m) => { console.log("Model loaded"); setModel(m); })
    .catch((err) => console.error("Model failed to load:", err?.message, err));
}, []);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    return { x, y };
  };

  const startDraw = (e) => {
    isDrawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    ctx.strokeStyle = "white";
    ctx.lineWidth = 20;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDraw = () => (isDrawing.current = false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setPrediction(null);
    setConfidences([]);
  };

  const predict = async () => {
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 1. Bounding box of the drawn strokes
  let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4] > 50) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return; // nothing drawn

  // 2. Square canvas with the digit centered and padded
  const side = Math.ceil(Math.max(maxX - minX, maxY - minY) * 1.4);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const squared = document.createElement("canvas");
  squared.width = side;
  squared.height = side;
  const sctx = squared.getContext("2d");
  sctx.fillStyle = "black";
  sctx.fillRect(0, 0, side, side);
  sctx.drawImage(canvas, side / 2 - cx, side / 2 - cy);

  // 3. Downscale to 28x28
  const small = document.createElement("canvas");
  small.width = 28;
  small.height = 28;
  const smctx = small.getContext("2d");
  smctx.imageSmoothingQuality = "high";
  smctx.drawImage(squared, 0, 0, 28, 28);

  // preview of what the model sees
  const pctx = previewRef.current.getContext("2d");
  pctx.imageSmoothingEnabled = false;
  pctx.drawImage(small, 0, 0, 140, 140);

  if (!model) return;

  const input = tf.tidy(() =>
    tf.browser.fromPixels(small, 1).toFloat().div(255).reshape([1, 28, 28, 1])
  );
  const output = model.predict(input);
  const probs = await output.data();
  input.dispose();
  output.dispose();

  setPrediction(probs.indexOf(Math.max(...probs)));
  setConfidences(Array.from(probs));
};

  return (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 16,
      marginTop: 40,
      fontFamily: "sans-serif",
    }}
  >
    <h1>Draw a digit</h1>

    <canvas
      ref={canvasRef}
      width={280}
      height={280}
      style={{ border: "2px solid #333", touchAction: "none" }}
      onMouseDown={startDraw}
      onMouseMove={draw}
      onMouseUp={stopDraw}
      onMouseLeave={stopDraw}
      onTouchStart={startDraw}
      onTouchMove={draw}
      onTouchEnd={stopDraw}
    />

    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={predict}>Predict</button>
      <button onClick={clearCanvas}>Clear</button>
    </div>

    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>What the model sees (28x28)</div>
      <canvas
        ref={previewRef}
        width={140}
        height={140}
        style={{ border: "1px solid #999" }}
      />
    </div>

    {prediction !== null && (
      <div style={{ textAlign: "center" }}>
        <h2>Prediction: {prediction}</h2>
        <div style={{ display: "inline-block", textAlign: "left" }}>
          {confidences.map((c, i) => (
            <div key={i}>
              {i}: {(c * 100).toFixed(1)}%
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);
}