import type { DataAdapter } from 'obsidian';
import type { ImageJob, ImageJobStore } from './imagejobs';
import type { ImageResult } from './seedream';
const validId=(id:string)=>/^[0-9a-f-]{36}$/i.test(id);
/** Binary results live beside the plugin, separately from secrets and canvas autosaves. */
export class VaultImageJobStore implements ImageJobStore {
  private stamp = 0;
  constructor(private adapter:DataAdapter,private root:string) {}
  private async folder(path:string):Promise<void>{if(!await this.adapter.exists(path)){try{await this.adapter.mkdir(path);}catch(e){if(!await this.adapter.exists(path))throw e;}}}
  async list():Promise<ImageJob[]> {
    if(!await this.adapter.exists(this.root))return [];
    const out:ImageJob[]=[];
    for(const folder of (await this.adapter.list(this.root)).folders){const id=folder.slice(folder.lastIndexOf('/')+1);if(!validId(id))continue;
      try{const files=(await this.adapter.list(`${this.root}/${id}`)).files.filter(f=>/\/\d{16}-[0-9a-f-]+\.json$/i.test(f)).sort().reverse();
        const manifest=files[0]??`${this.root}/${id}/job.json`;
        const j=JSON.parse(await this.adapter.read(manifest)) as ImageJob;
        if(j.id===id && typeof j.prompt==='string' && typeof j.model==='string' && typeof j.path==='string' && j.path.endsWith('.qcover') && !j.path.split('/').includes('..') && ['queued','running','ready','failed','interrupted'].includes(j.state))out.push(j);
      }catch{ /* A damaged task must not prevent plugin startup or hide other results. */ }
    }return out;
  }
  async write(job:ImageJob,output?:ImageResult):Promise<void>{
    if(!validId(job.id))throw Error('Invalid image task');
    await this.folder(this.root);const dir=`${this.root}/${job.id}`;await this.folder(dir);
    if(output)for(const [i,pic] of output.pictures.entries())await this.adapter.writeBinary(`${dir}/${i}.image`,pic.data);
    // Same-directory rename publishes the complete manifest only after all image files are saved.
    this.stamp=Math.max(Date.now(),this.stamp+1);
    const version=`${String(this.stamp).padStart(16,'0')}-${crypto.randomUUID()}`,tmp=`${dir}/${version}.tmp`;
    await this.adapter.write(tmp,JSON.stringify(job));await this.adapter.rename(tmp,`${dir}/${version}.json`);
  }
  async result(job:ImageJob):Promise<ImageResult>{
    if(!validId(job.id) || job.state!=='ready' || !Array.isArray(job.pictures))throw Error('Image results unavailable');
    const pictures=await Promise.all(job.pictures.map(async(meta,i)=>({...meta,data:await this.adapter.readBinary(`${this.root}/${job.id}/${i}.image`)})));
    return {pictures,warnings:job.warnings??[],usage:job.usage};
  }
}
