const active = new Map();
let total = 0;
const uploadCapacity = (req, res, next) => {
  const key = String(req.user._id);
  if ((active.get(key) || 0) >= 1 || total >= 4) return res.status(429).json({ message: "An audio request is already running. Please try again later.", messageKey: "security.audioBusy" });
  active.set(key, (active.get(key) || 0) + 1); total++;
  let released = false;
  const release = () => {
    if (released) return;
    released = true; total--;
    const remaining = (active.get(key) || 1) - 1;
    if (remaining) active.set(key, remaining); else active.delete(key);
  };
  res.once('finish', release);
  res.once('close', () => { if (!req.audioValidated) release(); });
  req.releaseAudioSlot = release;
  next();
};
const allowed = new Map([['audio/mpeg', 'audio/mpeg'], ['audio/wav', 'audio/wav'], ['audio/x-wav', 'audio/wav'],
  ['audio/ogg', 'audio/ogg'], ['video/ogg', 'audio/ogg'], ['video/webm', 'audio/webm'], ['audio/webm', 'audio/webm'],
  ['audio/mp4', 'audio/mp4'], ['video/mp4', 'audio/mp4'], ['audio/flac', 'audio/flac'], ['audio/aac', 'audio/aac']]);
const validateAudio = async (req, res, next) => {
  try {
    const { fileTypeFromBuffer } = await import('file-type');
    const type = req.file?.buffer?.length ? await fileTypeFromBuffer(req.file.buffer) : null;
    const mime = type && allowed.get(type.mime);
    if (!mime) return res.status(400).json({ message: "Please upload a supported audio recording.", messageKey: "security.invalidAudio" });
    // Use the detected container type, never the client-supplied MIME type.
    req.file.mimetype = mime;
    req.audioValidated = true;
    next();
  } catch { res.status(400).json({ message: "Invalid audio recording.", messageKey: "security.invalidAudio" }); }
};
const runAudio = controller => async (req, res, next) => {
  try { await controller(req, res, next); }
  catch (error) { next(error); }
  finally { req.releaseAudioSlot?.(); }
};
module.exports = { uploadCapacity, validateAudio, runAudio };
