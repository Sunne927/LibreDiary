<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useTemplatesStore, usePagesStore } from '@/stores';
import { useToast } from '@/composables';
import type { Template } from '@librediary/shared';
import TemplateLibrary from '@/components/TemplateLibrary.vue';

const router = useRouter();
const templatesStore = useTemplatesStore();
const pagesStore = usePagesStore();
const toast = useToast();

async function handleUseTemplate(template: Template) {
  try {
    const page = await templatesStore.createPageFromTemplate(template.id);
    await pagesStore.fetchPageTree();
    router.push({ name: 'page', params: { pageId: page.id } });
    toast.success(`已根据“${template.name}”创建页面`);
  } catch (e) {
    console.error('Failed to create page from template:', e);
    toast.error('根据模板创建页面失败');
  }
}

function handleClose() {
  router.push({ name: 'dashboard' });
}
</script>

<template>
  <div class="templates-page">
    <TemplateLibrary @use-template="handleUseTemplate" @close="handleClose" />
  </div>
</template>

<style scoped>
.templates-page {
  max-width: 640px;
  margin: 0 auto;
  height: 100%;
}
</style>
