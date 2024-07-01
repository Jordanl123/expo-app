import { ThemedView } from "@/components/ThemedView"
import { PaintStyle, Skia } from "@shopify/react-native-skia";
import { useState } from "react";
import { Text, StyleSheet, Button } from "react-native";
import { useTensorflowModel } from "react-native-fast-tflite";
import { Camera, runAsync, runAtTargetFps, useCameraDevice, useCameraFormat, useCameraPermission, useSkiaFrameProcessor } from "react-native-vision-camera";
import { useSharedValue } from "react-native-worklets-core";
import {useResizePlugin} from 'vision-camera-resize-plugin';

const desiredImageWidth = 320;
const desiredImageHeight = 320

export default function TabThreeScreen () {
    const objectDetection = useTensorflowModel(require('../../assets/yolov5.tflite'))
    const model = objectDetection.state === "loaded" ? objectDetection.model : undefined

    const { resize } = useResizePlugin()

    const device = useCameraDevice('back')
    const format = useCameraFormat(device, [{videoResolution: {height: desiredImageHeight, width: desiredImageWidth}}, {fps: 30}])
    const [cameraActive, setCameraActive] = useState(true)
    const { hasPermission, requestPermission } = useCameraPermission();
    const detections = useSharedValue<{bbox: number[], score: number; class: string}[]>([])

    const frameProcessor = useSkiaFrameProcessor((frame) => {
        'worklet'
        if (model == null) return

        frame.render()

        detections.value.forEach(({bbox}) => {
            const [x, y, width, height] = bbox
            const centerX = x * frame.width;
            const centerY = y * frame.height;
            const boxWidth = width * frame.width;
            const boxHeight = height * frame.height;

            // Calculate the top-left corner of the bounding box
            const topLeftX = centerX - (boxWidth / 2);
            const topLeftY = centerY - (boxHeight / 2);

            const rect = Skia.XYWHRect(topLeftX, topLeftY, boxWidth, boxHeight)
            const paint = Skia.Paint()
            paint.setColor(Skia.Color('red'))
            paint.setStyle(PaintStyle.Stroke)
            frame.drawRect(rect, paint)
        })

        runAtTargetFps(1, () => {
            'worklet'
            detections.value = []
            const resized = resize(frame, {
                scale: {
                    width: desiredImageWidth,
                    height: desiredImageHeight,
                },
                pixelFormat: 'rgb',
                dataType: 'float32',
            })
        
            // const normalized = new Float32Array(resized.length);
            // for (let i = 0; i < resized.length; i++) {
            //     normalized[i] = resized[i] / 255.0; // Normalize pixel values to [0, 1]
            // }
        
            // const batchedTensor = new Float32Array([1, 320, 320, 3].reduce((a, b) => a * b));
            // batchedTensor.set(normalized);

            const [outputData] = model.runSync([resized] as unknown as any)
        
            const numGridCells = 6300
            const numPredictions = 85
            const confidenceThreshold = 0.5;
        
            for (let i = 0; i < numGridCells; i++) {
                const startIndex = i * numPredictions
                const endIndex = startIndex + numPredictions
                const cellPredictions = outputData.slice(startIndex, endIndex)
        
                const [x, y, width, height, objectness] = cellPredictions.slice(0,5) as Float32Array
                const classProbabilities = cellPredictions.slice(5) as Float32Array;
        
                if (objectness > confidenceThreshold) {
                    const maxClassIndex = classProbabilities.indexOf(Math.max(...classProbabilities))
                    const maxClassProbability = classProbabilities[maxClassIndex]
        
                    // Create a detection object
                    const detection = {
                        bbox: [x, y, width, height],
                        score: objectness * maxClassProbability,
                        class: classDescriptions[maxClassIndex]
                    };
                if (!detections.value.some((previousDetection) => previousDetection.class === detection.class)) {
                    detections.value.push(detection);
                }
                }
            }
            console.log(detections.value.map((detection => detection.class)))
        })
    }, [model])

    if (!device) {
        return <Text style={styles.titleText}>No camera detected</Text>
    }
    if (!hasPermission) {
        requestPermission()
        return null;
    }
    
    return (
        <>
            <ThemedView style={{padding: 20}}>
                <Text style={styles.titleText}>Take a photo...</Text>
                <Button onPress={() => setCameraActive((prev) => !prev)} title={cameraActive ? 'Pause' : 'Resume'}/>
            </ThemedView>
            <Camera style={{ flex: 1 }} device={device} format={format} isActive={cameraActive} frameProcessor={frameProcessor}/>
        </>)
}

const styles = StyleSheet.create({
    titleText: {
      fontSize: 20,
      fontWeight: 'bold',
    },
  });

const classDescriptions = [
    "person",
    "bicycle",
    "car",
    "motorcycle",
    "airplane",
    "bus",
    "train",
    "truck",
    "boat",
    "traffic light",
    "fire hydrant",
    "stop sign",
    "parking meter",
    "bench",
    "bird",
    "cat",
    "dog",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
    "backpack",
    "umbrella",
    "handbag",
    "tie",
    "suitcase",
    "frisbee",
    "skis",
    "snowboard",
    "sports ball",
    "kite",
    "baseball bat",
    "baseball glove",
    "skateboard",
    "surfboard",
    "tennis racket",
    "bottle",
    "wine glass",
    "cup",
    "fork",
    "knife",
    "spoon",
    "bowl",
    "banana",
    "apple",
    "sandwich",
    "orange",
    "broccoli",
    "carrot",
    "hot dog",
    "pizza",
    "donut",
    "cake",
    "chair",
    "couch",
    "potted plant",
    "bed",
    "dining table",
    "toilet",
    "tv",
    "laptop",
    "mouse",
    "remote",
    "keyboard",
    "cell phone",
    "microwave",
    "oven",
    "toaster",
    "sink",
    "refrigerator",
    "book",
    "clock",
    "vase",
    "scissors",
    "teddy bear",
    "hair drier",
    "toothbrush"
  ];  
  