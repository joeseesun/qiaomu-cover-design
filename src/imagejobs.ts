import type { GeneratedPicture, ImageResult } from './seedream';
export type ImageJobState = 'queued' | 'running' | 'ready' | 'failed' | 'interrupted';
export interface ImageSelection { objects: {id:string;hash:string}[]; box: {left:number;top:number;width:number;height:number} }
export interface ImageJob {
  id: string; created: number; prompt: string; model: string; path: string; layers: boolean;
  target?: { id: string; hash: string }; selection?: ImageSelection; state: ImageJobState; error?: string;
  pictures?: Omit<GeneratedPicture, 'data'>[]; warnings?: string[]; usage?: ImageResult['usage'];
}
export interface ImageJobStore {
  list(): Promise<ImageJob[]>;
  write(job: ImageJob, output?: ImageResult): Promise<void>;
  result(job: ImageJob): Promise<ImageResult>;
}
/** Plugin-owned jobs do not depend on a modal or live canvas. A paid request is never retried automatically. */
export class ImageJobs {
  jobs = new Map<string, ImageJob>(); private active = 0; private disposed = false;
  private queue: {job:ImageJob;run:()=>Promise<ImageResult>}[] = [];
  private owned = new Set<string>(); private listeners = new Set<()=>void>();
  constructor(private store: ImageJobStore, private notify: (job:ImageJob)=>void) {}
  async refresh(): Promise<void> {
    for(const job of await this.store.list()) if(!this.owned.has(job.id)) this.jobs.set(job.id, {...job, state:job.state === 'queued' || job.state === 'running' ? 'interrupted' : job.state});
    this.emit();
  }
  subscribe(fn:()=>void):()=>void {this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  private emit():void {if(!this.disposed)for(const fn of this.listeners)fn();}
  async submit(input: Omit<ImageJob, 'id'|'created'|'state'>, run:()=>Promise<ImageResult>):Promise<ImageJob> {
    if(this.disposed)throw Error('Image jobs unloaded');
    const job:ImageJob={...input,id:crypto.randomUUID(),created:Date.now(),state:'queued'};
    await this.store.write(job);this.jobs.set(job.id,job);this.owned.add(job.id);this.queue.push({job,run});this.emit();this.pump();return job;
  }
  private pump():void {
    while(!this.disposed && this.active<2 && this.queue.length){const next=this.queue.shift()!;this.active++;void this.execute(next.job,next.run);}
  }
  private async execute(job:ImageJob,run:()=>Promise<ImageResult>):Promise<void> {
    try {
      job.state='running';await this.store.write(job);this.emit();
      const output=await run();if(!output.pictures.length)throw Error('No images returned');
      const completed:ImageJob={...job,state:'ready',pictures:output.pictures.map(({data:_data,...meta})=>meta),warnings:output.warnings,usage:output.usage};
      await this.store.write(completed,output);Object.assign(job,completed);
    }catch(e){job.state='failed';job.error=e instanceof Error?e.message:String(e);try{await this.store.write(job);}catch{job.error+=' (result storage unavailable)';}}
    finally{this.active--;this.emit();if(!this.disposed)this.notify(job);this.pump();}
  }
  result(job:ImageJob):Promise<ImageResult>{return this.store.result(job);}
  dispose():void{this.disposed=true;this.listeners.clear();this.queue=[];}
}
export async function imageHash(source:string):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
