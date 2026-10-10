import { Modal, Notice, setIcon } from 'obsidian';
import { FabricImage, Group, type FabricObject } from 'fabric';
import type CoverPlugin from './main';
import { imageHash, type ImageJob } from './imagejobs';
import type { QObject } from './view';
import { iconButton, textButton } from './ui';

export class ImageJobsDialog extends Modal {
  private unsubscribe?:()=>void;
  constructor(private plugin:CoverPlugin){super(plugin.app);}
  onOpen():void{this.titleEl.setText(this.plugin.t('imageTasks'));this.modalEl.addClass('qc-image-generate-modal');this.contentEl.addClass('qc-modal');this.unsubscribe=this.plugin.imageJobs.subscribe(()=>this.draw());this.draw();void this.plugin.imageJobs.refresh().catch(e=>this.plugin.report(e));}
  private draw():void {
    const el=this.contentEl;el.empty();const t=this.plugin.t.bind(this.plugin);
    const jobs=[...this.plugin.imageJobs.jobs.values()].sort((a,b)=>b.created-a.created);
    if(!jobs.length)el.createDiv({text:t('imageTasksEmpty'),cls:'qc-hint'});
    for(const job of jobs){const row=el.createDiv('qc-image-task');row.createDiv({text:job.prompt||t('imageDecompose'),cls:'qc-image-task-prompt'});row.createDiv({text:`${job.model} · ${t(job.state==='ready'?'imageTaskReady':job.state==='failed'?'imageTaskFailed':job.state==='interrupted'?'imageTaskInterrupted':job.state==='queued'?'imageTaskQueued':'imageGenerating')}`,cls:'qc-hint'});
      if(job.error)row.createDiv({text:job.error,cls:'qc-image-task-error'});
      if(job.state==='interrupted')row.createDiv({text:t('imageTaskRestartHint'),cls:'qc-hint'});
      if(job.state==='ready')textButton(row,t('imageViewResults'),()=>{this.close();new ImageResultsDialog(this.plugin,job).open();},'qc-btn-sm');
    }
  }
  onClose():void{this.unsubscribe?.();this.contentEl.empty();}
}
export class ImageResultsDialog extends Modal {
  private urls:string[]=[];private closed=false;private busy=false;
  constructor(private plugin:CoverPlugin,private job:ImageJob){super(plugin.app);}
  onOpen():void{this.closed=false;this.titleEl.setText(this.plugin.t('imageViewResults'));this.modalEl.addClass('qc-image-generate-modal');this.contentEl.addClass('qc-modal','qc-image-generate');void this.draw().catch(e=>{if(!this.closed)this.contentEl.createDiv({text:String(e),cls:'qc-hint'});});}
  private async draw():Promise<void>{
    const p=this.plugin,t=p.t.bind(p),job=this.job,output=await p.imageJobs.result(job);if(this.closed)return;
    const el=this.contentEl;el.empty();el.createDiv({text:job.prompt||t('imageDecompose'),cls:'qc-image-task-prompt'});el.createDiv({text:job.path,cls:'qc-hint'});
    const status=el.createDiv({cls:'qc-image-status',attr:{role:'status','aria-live':'polite'}});
    status.setText([t('imageResultsReady',{count:output.pictures.length}),...output.warnings].join('\n'));
    const grid=el.createDiv('qc-image-result-grid'),chosen=new Set<number>([0]);
    const apply=async(replace:boolean):Promise<void>=>{
      if(this.busy || !chosen.size)return;this.busy=true;sync();
      try{
        const file=p.app.vault.getFileByPath(job.path);if(!file)throw Error(t('imageTaskFileMissing'));
        await p.openDesign(file);const v=p.app.workspace.getLeavesOfType('qiaomu-cover-design').find(l=>(l.view as {file?:{path:string}}).file?.path===job.path)?.view;
        const view=v as import('./view').CoverView | undefined;if(!view?.canvas || !view.design || this.closed)throw Error(t('imageNotInserted'));
        let target:FabricImage|undefined;
        if(replace && job.target){const flatten=(objects:FabricObject[]):FabricObject[]=>objects.flatMap(o=>o instanceof Group?[o,...flatten(o.getObjects())]:[o]);const candidate=flatten(view.canvas.getObjects()).find(o=>(o as QObject).qcImageId===job.target!.id) as FabricImage | undefined;
          if(!candidate || !(candidate instanceof FabricImage) || await imageHash(candidate.getSrc())!==job.target.hash)throw Error(t('imageOriginalChanged'));target=candidate;}
        const guard=view.imageGuard(target),indices=job.layers?output.pictures.map((_,i)=>i):[...chosen];
        if(await view.applyImageResult(indices.map(i=>({...output.pictures[i]!, name:output.pictures[i]!.name??`${job.prompt.replace(/\s+/g,' ').slice(0,28)||t('imageResult')} ${i+1}`})),target,job.layers,()=>!this.closed&&guard())){await view.flush();new Notice(t('imageInserted'));this.close();}else status.setText(t('imageNotInserted'));
      }catch(e){if(!this.closed)status.setText(e instanceof Error?e.message:String(e));}finally{this.busy=false;if(!this.closed)sync();}
    };
    for(const [i,pic] of output.pictures.entries()){
      const url=URL.createObjectURL(new Blob([pic.data],{type:pic.type}));this.urls.push(url);
      const tile=grid.createDiv('qc-image-result-tile');
      iconButton(tile,'maximize-2',t('imageLargePreview'),()=>{const modal=new Modal(p.app);modal.titleEl.setText(pic.name??`${t('imageResult')} ${i+1}`);modal.modalEl.addClass('qc-image-preview-modal');modal.contentEl.addClass('qc-modal');modal.contentEl.createEl('img',{cls:'qc-image-large-preview',attr:{src:url,alt:pic.name??`${t('imageResult')} ${i+1}`}});modal.open();},'qc-image-expand');
      const card=tile.createEl('button',{cls:'qc-image-result-card',attr:{type:'button','aria-pressed':String(job.layers || i===0)}});setIcon(card.createSpan({cls:'qc-image-result-check'}),'check');card.createEl('img',{attr:{src:url,alt:pic.name??`${t('imageResult')} ${i+1}`}});card.createSpan({text:pic.name??pic.size??`${i+1}`});
      card.addEventListener('click',()=>{if(this.busy||job.layers)return;if(chosen.has(i))chosen.delete(i);else chosen.add(i);card.setAttribute('aria-pressed',String(chosen.has(i)));sync();});
    }
    const actions=el.createDiv('qc-image-result-actions');
    const insert=textButton(actions,t(job.layers?'imageInsertLayers':job.target?'imageInsertCopy':'imageInsertSelected'),()=>void apply(false),'qc-primary');
    const replace=job.target&&!job.layers?textButton(actions,t('imageReplaceOriginal'),()=>void apply(true)):undefined;
    const sync=():void=>{insert.disabled=this.busy||!chosen.size;if(replace)replace.disabled=this.busy||chosen.size!==1;};
    textButton(el,t('imageTasks'),()=>{this.close();p.openImageTasks();},'qc-btn-sm');sync();
  }
  onClose():void{this.closed=true;for(const url of this.urls)URL.revokeObjectURL(url);this.urls=[];this.contentEl.empty();}
}
