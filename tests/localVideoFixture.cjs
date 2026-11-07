const fs = require('node:fs');

// Spatial return playback seeks inside the clip. Serve the same byte-range
// contract as video storage so the fixture does not turn a seek into time zero.
function serveLocalVideo(req, res, file) {
 const size = fs.statSync(file).size;
 res.setHeader('Content-Type', 'video/mp4');
 res.setHeader('Accept-Ranges', 'bytes');
 res.setHeader('Cache-Control', 'public, max-age=3600');
 let start = 0, end = size - 1;
 if (req.headers.range) {
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if (range && (range[1] || range[2])) {
   start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
   end = range[1] && range[2] ? Math.min(end, Number(range[2])) : end;
  }
  if (!range || !(range[1] || range[2]) || start >= size || end < start) {
   res.statusCode = 416; res.setHeader('Content-Range', `bytes */${size}`); res.end(); return;
  }
  res.statusCode = 206; res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
 }
 res.setHeader('Content-Length', end - start + 1);
 if (req.method === 'HEAD') { res.end(); return; }
 const stream = fs.createReadStream(file, { start, end });
 res.on('close', () => stream.destroy());
 stream.on('error', error => res.destroy(error));
 stream.pipe(res);
}

module.exports = { serveLocalVideo };
