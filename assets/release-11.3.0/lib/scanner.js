import { validBarcode } from './model.js';
import { decodeImageData, expandUPCE } from './barcode.js';
const FORMATS=['ean_13','ean_8','upc_a','upc_e','itf'];
async function nativeDetector() {
  try {if(!globalThis.BarcodeDetector)return null;const supported=await BarcodeDetector.getSupportedFormats();const formats=FORMATS.filter(f=>supported.includes(f));return formats.length?new BarcodeDetector({formats}):null;}catch{return null;}
}
async function detectNative(detector,image) {
  if(!detector)return null;
  try {const codes=await detector.detect(image);for(const result of codes){const code=result.format==='upc_e'?expandUPCE(result.rawValue):result.rawValue;if(validBarcode(code))return code;}}catch{/* Fallback handles unsupported image sources. */}
  return null;
}
function draw(source,canvas,rotation=0,max=1100) {
  const width=source.videoWidth||source.naturalWidth||source.width,height=source.videoHeight||source.naturalHeight||source.height;
  if(!width||!height)return false;
  const scale=Math.min(1,max/Math.max(width,height));
  const w=Math.round(width*scale),h=Math.round(height*scale);
  canvas.width=rotation?h:w;canvas.height=rotation?w:h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return false;
  if(rotation){ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(Math.PI/2);ctx.drawImage(source,-w/2,-h/2,w,h);}else ctx.drawImage(source,0,0,w,h);
  return true;
}
function fallback(canvas) {const ctx=canvas.getContext('2d',{willReadFrequently:true});return decodeImageData(ctx.getImageData(0,0,canvas.width,canvas.height));}
export function cameraError(error) {
  if(error?.name==='NotAllowedError'||error?.name==='PermissionDeniedError')return 'Camera permission was denied. Allow camera access in your browser settings, or enter the barcode instead.';
  if(error?.name==='NotFoundError'||error?.name==='DevicesNotFoundError')return 'No camera was found on this device. You can upload a barcode photo or type its number.';
  if(error?.name==='NotReadableError')return 'Another app may be using the camera. Close it and try again, or enter the barcode manually.';
  return error?.message||'The camera could not start. Try a barcode photo or manual entry.';
}
export async function startCamera(video,{onCode,onReady,onError,signal}) {
  let stream=null,timer=0,stopped=false,detector=null,previous='',confirmations=0;
  const canvas=document.createElement('canvas');
  const stop=()=>{stopped=true;clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());video.pause();video.srcObject=null;signal?.removeEventListener('abort',stop);};
  signal?.addEventListener('abort',stop,{once:true});
  try {
    if(signal?.aborted){stop();return {stop};}
    if(!globalThis.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw new Error('Camera access needs HTTPS and a compatible browser. Open your deployed site over HTTPS, or enter the barcode.');
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}}});
    if(stopped||signal?.aborted){stop();return {stop};}
    video.srcObject=stream;video.muted=true;video.playsInline=true;await video.play();
    detector=await nativeDetector();
    if(stopped)return {stop};
    const track=stream.getVideoTracks()[0];
    const capabilities=track.getCapabilities?.()||{};
    onReady({native:Boolean(detector),torch:Boolean(capabilities.torch),toggleTorch:async enabled=>{try{await track.applyConstraints({advanced:[{torch:enabled}]});return true;}catch{return false;}}});
    const tick=async()=>{
      if(stopped||signal?.aborted)return;
      // Pause work when the tab is hidden. The controller also closes the camera on visibility change.
      if(document.hidden){timer=setTimeout(tick,500);return;}
      let code=null;
      try {code=await detectNative(detector,video);if(!code&&draw(video,canvas,0,1100))code=fallback(canvas);}catch{/* A camera frame can be empty while autofocus settles. */}
      if(stopped)return;
      if(code){confirmations=code===previous?confirmations+1:1;previous=code;if(confirmations>=2){stop();onCode(code);return;}}
      else {previous='';confirmations=0;}
      timer=setTimeout(tick,180);
    };
    timer=setTimeout(tick,180);
    return {stop};
  } catch(error){stop();if(!signal?.aborted)onError(cameraError(error));return {stop};}
}
export async function scanPhoto(file) {
  if(!file||!file.type.startsWith('image/'))throw new Error('Choose a photo of the barcode, such as a JPG, PNG or WebP.');
  if(file.size>15*1024*1024)throw new Error('Choose a barcode photo smaller than 15 MB.');
  const url=URL.createObjectURL(file),image=new Image();
  try {
    image.src=url;await image.decode();
    if(image.naturalWidth*image.naturalHeight>40_000_000)throw new Error('This image is too large. Crop it to the barcode and try again.');
    const detector=await nativeDetector();
    const native=await detectNative(detector,image);if(native)return native;
    const canvas=document.createElement('canvas');
    for(const rotation of [0,90]){draw(image,canvas,rotation,1800);const code=fallback(canvas);if(code)return code;}
    throw new Error('No readable EAN or UPC barcode was found. Crop tightly, keep the bars straight and sharp, or enter the digits.');
  } catch(error){if(error instanceof DOMException)throw new Error('Your browser could not open this image. Try a JPG or PNG.');throw error;}
  finally {URL.revokeObjectURL(url);}
}
