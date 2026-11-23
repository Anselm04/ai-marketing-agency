import { parseTimedTranscript, annotateClipEvidence } from '../services/clipEvidence.js';

describe('clip source evidence',()=>{
 const transcript='[0.00s-12.20s] First lesson.\n[12.20s-25.00s] Second lesson.';
 const clip=(startSeconds,endSeconds)=>({id:'clip-1',startSeconds,endSeconds});
 it('parses actual transcription segment times',()=>{
   expect(parseTimedTranscript(transcript)).toHaveLength(2);
 });
 it('annotates matched segments without pretending media was published',()=>{
   const [result]=annotateClipEvidence([clip(5,16)],transcript,{sourceDurationSeconds:30});
   expect(result.sourceEvidence.kind).toBe('timestamped_transcript');
   expect(result.sourceEvidence.segments).toHaveLength(2);
   expect(result.sourceEvidence.verifiedTimestampAlignment).toBe(true);
 });
 it('rejects invented timestamps outside transcript coverage',()=>{
   expect(()=>annotateClipEvidence([clip(30,40)],transcript,{sourceDurationSeconds:50}))
     .toThrow('lack time-coded source evidence');
 });
 it('rejects clip bounds outside source duration',()=>{
   expect(()=>annotateClipEvidence([clip(20,40)],transcript,{sourceDurationSeconds:30}))
     .toThrow('exceeds source media boundaries');
 });
 it('never reports verified timestamp alignment from unstructured notes',()=>{
   const [result]=annotateClipEvidence([clip(0,20)],'A creator-provided note',{sourceDurationSeconds:30});
   expect(result.sourceEvidence.verifiedTimestampAlignment).toBe(false);
 });
});
