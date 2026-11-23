/**
 * Associates proposed clips with actual time-coded transcript segments.
 * Does not pretend AI-generated timestamps are verified video edits.
 */
export function parseTimedTranscript(transcript) {
 const pattern=/^\[(\d+(?:\.\d+)?)s-(\d+(?:\.\d+)?)s\]\s*(.+)$/gm;
 const segments=[];
 for (const match of String(transcript||'').matchAll(pattern)) {
   const start=Number(match[1]),end=Number(match[2]);
   if(Number.isFinite(start)&&Number.isFinite(end)&&end>start)
     segments.push({startSeconds:start,endSeconds:end,text:match[3].trim()});
 }
 return segments;
}
export function annotateClipEvidence(clips,transcript,{sourceDurationSeconds}={}) {
 const segments=parseTimedTranscript(transcript);
 const duration=Number(sourceDurationSeconds);
 return clips.map(clip=>{
   const start=Number(clip.startSeconds),end=Number(clip.endSeconds);
   const withinDuration=!Number.isFinite(duration)||duration<=0||end<=duration;
   const overlaps=segments.filter(s=>s.startSeconds<end&&s.endSeconds>start);
   const valid=Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end>start&&withinDuration;
   if(!valid)throw Object.assign(new Error('Clip exceeds source media boundaries'),{code:'clipping_source_bounds_invalid'});
   if(segments.length>0&&overlaps.length===0)
     throw Object.assign(new Error('Clip timestamps lack time-coded source evidence'),{code:'clipping_timestamp_evidence_missing'});
   return {...clip,sourceEvidence:{
     kind:segments.length?'timestamped_transcript':'unverified_source_notes',
     verifiedTimestampAlignment:segments.length>0,
     segments:overlaps.map(s=>({...s}))
   }};
 });
}
