/** 页面内确认层：安全取消、键盘焦点约束；不直接修改工程或执行 Editor 命令。 */
export default {
  props:{state:{type:Object,required:true}},
  emits:['confirm','cancel'],
  mounted() {
    this.previousFocus=document.activeElement;
    this.$nextTick(()=>this.$refs.cancel?.focus({preventScroll:true}));
    this.focusGuard=event=>{
      if(!this.$refs.card?.contains(event.target))this.$refs.cancel?.focus({preventScroll:true});
    };
    document.addEventListener('focusin',this.focusGuard,true);
  },
  beforeUnmount() {
    document.removeEventListener('focusin',this.focusGuard,true);
    if(this.previousFocus?.isConnected)this.previousFocus.focus({preventScroll:true});
  },
  methods:{
    onKey(event) {
      // 所有按键都留在弹窗里，不能触发画布删除/移动/绘制快捷键。
      event.stopPropagation();
      if(event.key==='Escape'){event.preventDefault();this.$emit('cancel');return;}
      if(event.key!=='Tab')return;
      const buttons=[...this.$refs.card.querySelectorAll('button:not(:disabled)')];
      const first=buttons[0],last=buttons.at(-1),active=document.activeElement;
      if(event.shiftKey&&active===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&active===last){event.preventDefault();first?.focus();}
    }
  },
  template:`<Teleport to="body">
    <div class="modal-backdrop workbench-confirm-backdrop" @click.self="$emit('cancel')" @pointerdown.stop @keydown.capture="onKey">
      <section ref="card" class="modal-card workbench-confirm" role="alertdialog" aria-modal="true" aria-labelledby="workbench-confirm-title" aria-describedby="workbench-confirm-description">
        <div class="workbench-confirm-heading"><span class="workbench-confirm-symbol" aria-hidden="true">!</span><h3 id="workbench-confirm-title">{{state.title}}</h3><button class="modal-close" aria-label="取消并关闭" @click="$emit('cancel')">×</button></div>
        <p id="workbench-confirm-description">{{state.description}}</p>
        <div v-if="state.labels.length" class="workbench-confirm-parts"><span v-for="label in state.labels" :key="label">{{label}}</span></div>
        <p class="workbench-confirm-hint">{{state.hint}}</p>
        <div class="modal-actions"><button ref="cancel" class="soft-button" @click="$emit('cancel')">取消 <kbd>Esc</kbd></button><button class="workbench-confirm-danger" @click="$emit('confirm')">{{state.confirmLabel}}</button></div>
      </section>
    </div>
  </Teleport>`
};
