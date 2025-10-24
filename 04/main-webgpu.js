const shader = `
struct VSOut {
    @builtin(position) position: vec4<f32>
};

@group(0) @binding(0)
var<uniform> uColor: vec4<f32>;

@group(0) @binding(1)
var<uniform> uTransform: mat4x4<f32>;

@vertex
fn vs_main(@location(0) inPos: vec2<f32>) -> VSOut {
    var out: VSOut;
    out.position = uTransform * vec4<f32>(inPos, 1.0, 1.0);
    return out;
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
    return uColor;
}
`;

let shaderModule;
let bindGroupLayout;
let pipeline;

let canvas;
let device;

let context;
let format;
let msaaTexture;

let keysPressed = {};

const initWebGpu = async () => {
    if (!("gpu" in navigator)) {
        document.body.innerHTML = "Your browser does not support WebGPU";
        throw new Error("Webgpu not supported");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No GPU adaptor found.");

    canvas = document.getElementById("c");
    device = await adapter.requestDevice();

    context = canvas.getContext('webgpu');
    format = navigator.gpu.getPreferredCanvasFormat();
};

const initShaders = () => {
    shaderModule = device.createShaderModule({code: shader});
    bindGroupLayout = device.createBindGroupLayout({
        entries: [
            {
                binding: 0, // uColor
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {type: "uniform"}
            },
            {
                binding: 1, // uTransform
                visibility: GPUShaderStage.VERTEX,
                buffer: {type: "uniform"}
            }
        ]
    });
    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
    });
    pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: shaderModule,
            entryPoint: "vs_main",
            buffers:[{
                arrayStride: 2 * 4,
                attributes: [{
                    shaderLocation: 0,
                    offset: 0,
                    format: "float32x2"
                }]
            }]
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fs_main",
            targets: [{format}]
        },
        primitive: {
            topology: "triangle-list"
        },
        multisample: {
            count: 4
        }
    })
}

const resizeCanvasToDisplaySize = () =>  {
    const dpr = window.devicePixelRatio || 1;
    const width  = Math.floor(canvas.clientWidth  * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        configureContext();
    }
}

const configureContext = () => {
    context.configure({
        device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: "premultiplied"
    });
    msaaTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        sampleCount: 4,
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
}

const bufferFromArray = (array, usage) => { 
    const alignedSize = (array.byteLength + 3) & ~3; 
    const buffer = device.createBuffer({ 
        size: alignedSize, 
        usage, 
        mappedAtCreation: false 
    }); 
    
    // If array length isn't a multiple of 4 bytes, pad it temporarily
    if (array.byteLength % 4 !== 0) {
        const padded = new Uint8Array(alignedSize);
        padded.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));
        device.queue.writeBuffer(buffer, 0, padded);
    } else {
        device.queue.writeBuffer(buffer, 0, array);
    }

    return buffer;
}

const createFish = (offset, color, scale = 1, direction = 1, isMain = false) => {
    const bodyVertices = new Float32Array([
         0.5,  0.0,  // 0: nose
         0.2,  0.25, // 1: upper body
        -0.2,  0.15, // 2: upper tail base
        -0.4,  0.3,  // 3: upper tail tip
        -0.4, -0.3,  // 4: lower tail tip
        -0.2, -0.15, // 5: lower tail base
         0.2, -0.25, // 6: lower body
    ]);
    const bodyIndices = new Uint16Array([
        0, 1, 6, // main body
        1, 2, 6, // upper mid-body
        2, 5, 6, // rear body
        2, 3, 5, // tail top
        3, 4, 5, // tail fin
    ]);

    const eyeOffset = 0.02;

    const eyeVertices =  direction == -1 ? 
        new Float32Array([
            0.2 - eyeOffset, -0.15 - eyeOffset,
            0.2 - eyeOffset, -0.15 + eyeOffset,
            0.2 + eyeOffset, -0.15 - eyeOffset,
            0.2 + eyeOffset, -0.15 + eyeOffset,
        ]):
        new Float32Array([
            0.2 - eyeOffset, 0.15 - eyeOffset,
            0.2 - eyeOffset, 0.15 + eyeOffset,
            0.2 + eyeOffset, 0.15 - eyeOffset,
            0.2 + eyeOffset, 0.15 + eyeOffset,
        ]);

    const eyeIndicies = new Uint16Array([
        0, 1, 3,
        0, 2, 3
    ]);

    const eyeColor = new Float32Array([0.0, 0.0, 0.0, 1.0]);

    const bodyVertexBuffer = bufferFromArray(bodyVertices, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    const bodyIndexBuffer  = bufferFromArray(bodyIndices,  GPUBufferUsage.INDEX  | GPUBufferUsage.COPY_DST);
    const eyeVertexBuffer  = bufferFromArray(eyeVertices,  GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
    const eyeIndexBuffer   = bufferFromArray(eyeIndicies,  GPUBufferUsage.INDEX  | GPUBufferUsage.COPY_DST);
    const colorBuffer      = bufferFromArray(new Float32Array(color), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    const eyeColorBuffer   = bufferFromArray(eyeColor,     GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

    return {
        bodyVertexBuffer,
        bodyIndexBuffer,
        eyeVertexBuffer,
        eyeIndexBuffer,
        colorBuffer,
        eyeColorBuffer,
        offset: offset,
        color: color,
        scale: scale,
        direction: direction,
        isMain: isMain
    }
}

const clampFish = (fish) => {
    if (fish.offset[0] <= - 1) fish.offset[0] = 1;
    else if (fish.offset[0] >= 1) fish.offset[0] = -1;
    else if (fish.offset[1] <= -1) fish.offset[1] = 1;
    else if (fish.offset[1] >= 1) fish.offset[1] = -1;
}

const moveFish = (fish) => {
    fish.offset[0] += 0.01 * fish.direction;
    fish.offset[1] += 0.01 * Math.random();
    fish.offset[1] -= 0.01 * Math.random();
}

const drawFish = (pass, fish) => {
    const theta = Math.random() * 2 * Math.PI / 100;
    const transform = new Float32Array([
        fish.direction * fish.scale * Math.cos(theta), -Math.sin(theta), 0, 0,
        Math.sin(theta), fish.direction * fish.scale * Math.cos(theta), 0, 0,
        0, 0, fish.scale, 0,
        fish.offset[0], fish.offset[1], fish.offset[2], 1
    ]);
    const transformBuffer = bufferFromArray(transform, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    const bodyBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: { buffer: fish.colorBuffer }
            },
            {
                binding: 1,
                resource: { buffer: transformBuffer }
            }
        ]
    });

    pass.setVertexBuffer(0, fish.bodyVertexBuffer);
    pass.setIndexBuffer(fish.bodyIndexBuffer, "uint16");
    pass.setBindGroup(0, bodyBindGroup);
    pass.drawIndexed(15, 1, 0, 0, 0);

    const eyeBindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
            {
                binding: 0,
                resource: { buffer: fish.eyeColorBuffer }
            },
            {
                binding: 1,
                resource: { buffer: transformBuffer }
            }
        ]
    });

    pass.setVertexBuffer(0, fish.eyeVertexBuffer);
    pass.setIndexBuffer(fish.eyeIndexBuffer, "uint16");
    pass.setBindGroup(0, eyeBindGroup);
    pass.drawIndexed(6, 1, 0, 0, 0);
}

let allFish = [];
let mainFish;

function animate() {   
    const encoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();
    
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: msaaTexture.createView(),
            resolveTarget: textureView,
            clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 0.0 },
            loadOp: "clear",
            storeOp: "store"
        }]
    });

    pass.setPipeline(pipeline);

    for (const fish of allFish) {
        moveFish(fish);
        clampFish(fish);
        drawFish(pass, fish);
    }

    if (keysPressed["ArrowUp"]) {
        mainFish.offset[1] += 0.02;
    }
    if (keysPressed["ArrowDown"]) {
        mainFish.offset[1] -= 0.02;
    }
    if (keysPressed["ArrowLeft"]) {
        mainFish.offset[0] -= 0.02;
    }
    if (keysPressed["ArrowRight"]) {
        mainFish.offset[0] += 0.02;
    }

    clampFish(mainFish);
    drawFish(pass, mainFish);

    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(animate);
}

window.addEventListener("keydown", (event) => {
    keysPressed[event.key] = true;
});

window.addEventListener("keyup", (event) => {
    keysPressed[event.key] = false;
});

window.onload = async () => {
    await initWebGpu();
    initShaders();
    resizeCanvasToDisplaySize();
    configureContext();    

    for (let i = 0; i < 100; i++) {
        const random_color  = [Math.random(), Math.random(), Math.random(), Math.random()];
        const random_offset = [Math.random() - Math.random(), Math.random() - Math.random(), 0];
        const random_scale  = Math.max(0.1, Math.random() * 0.3);
        allFish.push(createFish(random_offset, random_color, random_scale, 1))
    }
    mainFish = createFish([0, 0, 0], [1, 0, 0, 0.5], 1, -1, true);

    requestAnimationFrame(animate);
}