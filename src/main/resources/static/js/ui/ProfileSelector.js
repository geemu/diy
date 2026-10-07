import {getDesignProfileDefinition, groupDesignProfiles} from '../model/DesignProfileCatalog.js';

/** 所有选材入口共用尺寸 → 型号级联，不在 UI 内合并或修改工程型号。 */
export default {
  props:{profiles:{type:Array,required:true},modelValue:{type:String,default:''},inputId:{type:String,required:true},catalogPresentation:{type:Boolean,default:false}},
  emits:['update:modelValue','change'],
  computed:{
    groups(){
      // 停用型号不提供给新建，但已使用构件的属性仍必须正确显示原型号。
      const current=this.profiles.some(item=>item.id===this.modelValue)?null:getDesignProfileDefinition(this.modelValue);
      return groupDesignProfiles(current?[...this.profiles,current]:this.profiles);
    },
    selectedGroup(){return this.groups.find(group=>group.models.some(model=>model.id===this.modelValue));},
    selectedModels(){return this.selectedGroup?.models||[];}
  },
  methods:{
    choose(id){if(!id||id===this.modelValue)return;const previousId=this.modelValue;this.$emit('update:modelValue',id);this.$emit('change',{previousId,profileId:id});},
    chooseGroup(event){const group=this.groups.find(item=>item.id===event.target.value);this.choose(group?.models[0]?.id);},
    modelLabel(model){return model.id.startsWith('DESIGN-')?model.id.slice(7):model.name;},
    groupLabel(group){
      if(!this.catalogPresentation)return group.label;
      const profile=group.models[0];
      return profile.shape==='U_CHANNEL'?'A柱 U型 8x8':`欧标${profile.width}x${profile.height}`;
    }
  },
  template:`<div class="profile-selector">
    <div class="field-stack"><label :for="inputId">{{catalogPresentation?'规格尺寸':'截面规格'}}</label><select :id="inputId" :value="selectedGroup?.id||''" @change="chooseGroup"><option v-for="group in groups" :key="group.key" :value="group.id">{{groupLabel(group)}}</option></select></div>
    <div v-if="!catalogPresentation||selectedModels.length>1" class="field-stack"><label :for="inputId+'-model'">具体型号</label><select :id="inputId+'-model'" :value="modelValue" @change="choose($event.target.value)"><option v-for="model in selectedModels" :key="model.id" :value="model.id">{{modelLabel(model)}}</option></select></div>
  </div>`
};
