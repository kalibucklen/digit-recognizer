import { useRef, useState, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";

export default function App() {
  const canvasRef = useRef(null);
  const [model, setModel] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [confidences, setConfidences] = useState([]);
  const isDrawing = useRef(false);

  useEffect(() => {
    tf.loadLayersModel("/tfjs_model/model.json")
      .then((m) => {
        console.log("Model loaded successfully");
        setModel(m);
      })
      // .catch((err) => {
      //   console.error("Model failed to load:", err);
      // });
      .catch((err) => {
      console.error("Model failed to load - message:", err?.message);
      console.error("Model failed to load - full:", err);
});
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
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
  if (!model) return;

  const small = document.createElement("canvas");
  small.width = 28;
  small.height = 28;
  small.getContext("2d").drawImage(canvasRef.current, 0, 0, 28, 28);

  const tensor = tf.browser
    .fromPixels(small, 1)
    .toFloat()
    .div(255.0)
    .reshape([1, 784]); // flat vector, not [1, 28, 28, 1]

  const output = model.predict(tensor);
  const data = await output.data();

  const top = data.indexOf(Math.max(...data));
  setPrediction(top);
  setConfidences(Array.from(data));
};

  return (
    <div style={{ textAlign: "center", marginTop: 40, fontFamily: "sans-serif" }}>
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
      <div style={{ marginTop: 16 }}>
        <button onClick={predict}>Predict</button>
        <button onClick={clearCanvas} style={{ marginLeft: 8 }}>Clear</button>
      </div>
      {prediction !== null && (
        <div style={{ marginTop: 20 }}>
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