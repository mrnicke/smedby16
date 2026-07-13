export type ScheduledJob={id:string;status:'pending'|'processing'|'completed'|'failed'|'cancelled';executeAt:string};
export function claimScheduledJob(job:ScheduledJob,now=new Date()){return job.status==='pending'&&new Date(job.executeAt)<=now?{...job,status:'processing' as const}:null;}
