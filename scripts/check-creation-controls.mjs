import fs from 'node:fs';
import ts from 'typescript';

const files = [
  'PromptInput', 'PlanSteps', 'AspectRatioBox', 'PromptToolbar', 'Storybook', 'PublishLoader', 'PublishLoader2', 'WorldCreation',
  'WorldCreationEdits', 'WorldImage', 'SectionCard', 'ArtStyleSelector', 'ModelSelectionModal',
  'ConversationModelPicker', 'PromptWelcomeUI', 'Notepad', 'NotepadEditor', 'WorldModel', 'WorldList',
  'WorldListOpened', 'ManualCharacterDialog', 'AudioPicker', 'VoicePicker', 'Thumbnail', 'EditStory', 'MediaPrompt', 'MediaFinalImage', 'MediaPromptVideo', 'ModalAnimate', 'ModalVideoPreview', 'components/PromptConstructor', 'components/TemplateGallery',
  'components/BrainstormChat', 'components/MusicScenePanel', 'components/MotionGuidePreview',
].map(name => `src/${name}.tsx`);
const controls = [];
const errors = [];
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  for (const diagnostic of source.parseDiagnostics) errors.push(`${file}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`);
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'cb') {
      const [area, key, label, handler, kind, policy] = node.arguments;
      if (![area, key, label, handler].every(Boolean)) errors.push(`${file}: incomplete binding`);
      controls.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        area: area.text, key: ts.isStringLiteral(key) ? key.text : key.getText(source),
        label: ts.isStringLiteral(label) ? label.text : label.getText(source),
        handler: handler.text, kind: kind?.text || 'click', policy: policy?.text || 'candidate' });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}
for (const key of ['spatial', 'hotspots']) {
  if (!controls.some(c => c.area === 'interaction' && c.key === key && c.policy === 'needs_confirmation')) errors.push(`Missing protected Games ${key} binding`);
}
if (!controls.some(c => c.area === 'notepad' && c.key === 'prompt' && c.kind === 'text')) errors.push('Missing actual editable prompt binding');
if (!controls.some(c => c.area === 'setup' && c.key === 'ratio' && c.handler === 'cycleAspectRatio')) errors.push('Aspect ratio must cycle');
if (!controls.some(c => c.area === 'preview_choice' && c.key === 'skip' && c.policy === 'needs_handoff'))
  errors.push('Preview choice Skip must stop at the Storybook handoff boundary');
if (!controls.some(c => c.area === 'preview_choice' && c.key === 'create_characters' && c.policy === 'needs_confirmation'))
  errors.push('Starting character detection and image generation requires confirmation');
for (const [area, key, policy] of [
  ['character_entry', 'open', 'candidate'],
  ['character_studio', 'find_characters', 'needs_confirmation'],
  ['character_studio', 'generate_images', 'needs_confirmation'],
  ['character_studio', 'continue', 'needs_handoff'],
  ['character_studio', 'cancel_auto_continue', 'candidate'],
  ['character_studio', 'show_scenes', 'candidate'],
  ['character_scenes', 'close', 'candidate'],
  ['character_scene_preview', 'close', 'candidate'],
  ['reference_editor', 'update_editor', 'candidate'],
  ['reference_editor', 'prompt_editor', 'candidate'],
  ['reference_editor', 'refine_ai', 'needs_confirmation'],
  ['reference_editor', 'regenerate', 'needs_confirmation'],
  ['reference_editor', 'close', 'candidate'],
  ['character_rename', 'save', 'needs_confirmation'],
]) {
  if (!controls.some(c => c.area === area && c.key === key && c.policy === policy))
    errors.push(`Missing or misclassified ${area}.${key} binding`);
}
for (const key of ['character_update_instruction', 'character_image_prompt']) {
  if (!controls.some(c => c.area === 'notepad' && c.key === key && c.kind === 'text'))
    errors.push(`Missing actual editable ${key} text binding`);
}
if (!controls.some(c => c.area === 'preview_choice' && c.key === 'update_with_ai' && c.policy === 'needs_confirmation'))
  errors.push('Updating the generated plan with AI requires confirmation');
if (!controls.some(c => c.area === 'preview_choice' && c.key === 'intent'))
  errors.push('Missing generated-intent viewer');
for (const [area, key, policy] of [
  ['storybook_start', 'start', 'candidate'],
  ['storybook_grid', 'start_auto_images', 'needs_confirmation'],
  ['storybook_grid', 'continue', 'candidate'],
  ['storybook_grid', 'music', 'candidate'],
  ['music', 'scroll', 'candidate'],
  ['music', 'close', 'candidate'],
  ['storybook_voice_picker', 'open_music', 'candidate'],
  ['storybook_toolbar', 'pixels_balance', 'information_only'],
  ['storybook_toolbar', 'slideshow', 'information_only'],
  ['storybook_toolbar', 'confirm_close', 'needs_confirmation'],
  ['storybook_grid', 'create_world', 'candidate'],
  ['storybook_grid', 'publish', 'needs_confirmation'],
  ['storybook_studio_selector', 'enter_studio', 'candidate'],
  ['storybook_studio_selector', 'narration', 'candidate'],
  ['storybook_world', 'generate_blueprint', 'needs_confirmation'],
  ['storybook_world', 'create', 'needs_confirmation'],
  ['storybook_world_character', 'generate', 'needs_confirmation'],
  ['storybook_bshot_warning', 'confirm_narration_reset', 'needs_confirmation'],
  ['storybook_bshot_warning', 'cancel_narration_reset', 'candidate'],
  ['storybook_bshot_warning', 'rebuild_length', 'needs_confirmation'],
  ['storybook_publish', 'process_video', 'needs_confirmation'],
  ['storybook_publish', 'preview_spatial', 'candidate'],
  ['storybook_publish', 'publish_spatial', 'needs_confirmation'],
  ['storybook_publish', 'start_hotspot_setup', 'needs_confirmation'],
  ['storybook_spatial_preview', 'verify', 'information_only'],
  ['storybook_spatial_preview', 'close', 'candidate'],
  ['post_finish', 'save_post', 'needs_confirmation'],
  ['post_finish', 'retry_search_metadata', 'needs_confirmation'],
  ['workstation_image', 'upscale', 'candidate'],
  ['workstation_image', 'confirm_upscale', 'needs_confirmation'],
  ['workstation_image', 'upload_image', 'information_only'],
  ['workstation_image', 'open_update_editor', 'candidate'],
  ['workstation_image', 'open_prompt_editor', 'candidate'],
  ['workstation_image', 'toggle_auto', 'candidate'],
  ['workstation_image', 'default', 'needs_confirmation'],
  ['workstation_image', 'enhance', 'needs_confirmation'],
  ['workstation_image', 'safety', 'needs_confirmation'],
  ['workstation_image', 'remix', 'candidate'],
  ['workstation_image', 'close', 'candidate'],
  ['workstation_image', 'recreate', 'needs_confirmation'],
  ['workstation_image', 'update_prompt', 'needs_confirmation'],
  ['workstation_image_context', 'open', 'candidate'],
  ['workstation_image_context', 'close', 'candidate'],
  ['workstation_image_context', 'add_to_characters', 'needs_confirmation'],
  ['workstation_image_context', 'upload_result_image', 'information_only'],
  ['workstation_image_remix', 'edit', 'needs_confirmation'],
  ['workstation_image_remix', 'close', 'candidate'],
  ['workstation_video', 'upload_video', 'information_only'],
  ['workstation_video', 'open_context', 'candidate'],
  ['workstation_video', 'upscale', 'candidate'],
  ['workstation_video', 'confirm_upscale', 'needs_confirmation'],
  ['workstation_video', 'add_video', 'needs_handoff'],
  ['workstation_video', 'toggle_reference_video', 'candidate'],
  ['workstation_video', 'lipsync', 'needs_confirmation'],
  ['workstation_video', 'open_update_editor', 'candidate'],
  ['workstation_video', 'open_prompt_editor', 'candidate'],
  ['workstation_video', 'mode_text', 'candidate'],
  ['workstation_video', 'mode_visual', 'candidate'],
  ['workstation_video', 'mode_motion', 'candidate'],
  ['workstation_video', 'auto_prompt', 'needs_confirmation'],
  ['workstation_video', 'toggle_duration', 'candidate'],
  ['workstation_video', 'toggle_audio', 'candidate'],
  ['workstation_video', 'create_visual_guide', 'needs_confirmation'],
  ['workstation_video', 'build_motion_guide', 'needs_confirmation'],
  ['workstation_video', 'generate_video', 'needs_confirmation'],
  ['workstation_video', 'open_action_image', 'candidate'],
  ['workstation_video', 'open_storyboard', 'candidate'],
  ['workstation_video', 'show_first_frames', 'candidate'],
  ['workstation_video', 'show_canon_scenes', 'candidate'],
  ['workstation_video', 'add_character', 'needs_handoff'],
  ['workstation_video', 'open_gpu', 'candidate'],
  ['workstation_video', 'model_seedance_1_5', 'candidate'],
  ['workstation_video', 'model_omni_flash', 'candidate'],
  ['workstation_video', 'model_seedance_2_5', 'candidate'],
  ['workstation_video', 'select_resolution', 'candidate'],
  ['workstation_video', 'close', 'candidate'],
  ['workstation_video_context', 'close', 'candidate'],
  ['workstation_video_context', 'draw', 'information_only'],
  ['workstation_video_context', 'default_frame', 'candidate'],
  ['workstation_video_context', 'toggle_direct_video', 'candidate'],
  ['workstation_video_context', 'frame_history', 'candidate'],
  ['workstation_video_context', 'motion_transfer', 'candidate'],
  ['workstation_video_context', 'use_frame', 'candidate'],
  ['workstation_motion_transfer', 'upload_motion_video', 'needs_handoff'],
  ['workstation_motion_transfer', 'replace_motion_video', 'needs_handoff'],
  ['workstation_motion_transfer', 'generate', 'needs_confirmation'],
  ['workstation_motion_transfer_segment', 'select_segment', 'candidate'],
  ['workstation_motion_transfer_segment', 'confirm_process', 'needs_confirmation'],
  ['workstation_motion_transfer_segment', 'use_processed_video', 'candidate'],
  ['workstation_action_image', 'generate', 'needs_confirmation'],
  ['workstation_action_image', 'prompt', 'candidate'],
  ['workstation_storyboard_image', 'apply_update', 'needs_confirmation'],
  ['workstation_storyboard_image', 'generate', 'needs_confirmation'],
  ['workstation_action_image_viewer', 'use', 'candidate'],
  ['workstation_action_image_viewer', 'delete', 'needs_confirmation'],
  ['workstation_gpu', 'start', 'needs_confirmation'],
  ['workstation_gpu', 'request_shutdown', 'needs_confirmation'],
  ['workstation_gpu', 'confirm_shutdown', 'needs_confirmation'],
  ['workstation_gpu_time', 'convert_30_minutes', 'needs_confirmation'],
  ['workstation_visual_guide', 'open', 'candidate'],
  ['workstation_visual_guide', 'open_source', 'candidate'],
  ['workstation_visual_guide', 'apply_edit', 'needs_confirmation'],
  ['workstation_visual_guide', 'confirm_delete', 'needs_confirmation'],
  ['workstation_motion_guide', 'expand', 'candidate'],
  ['workstation_motion_guide', 'edit', 'needs_confirmation'],
  ['workstation_motion_guide', 'retry_export', 'candidate'],
  ['workstation_motion_guide', 'confirm_delete', 'needs_confirmation'],
]) {
  if (!controls.some(c => c.area === area && c.key === key && c.policy === policy))
    errors.push(`Missing or misclassified ${area}.${key} binding`);
}
if (!controls.some(c => c.area === 'workstation_video' && c.key.includes('resolution_${resolution}') && c.policy === 'candidate'))
  errors.push('Mounted video resolution options must expose their own live action IDs');
if (!controls.some(c => c.area === 'workstation_image_context' && c.key.includes('select_result_') && c.policy === 'candidate'))
  errors.push('Image history result selection must be mapped');
if (!controls.some(c => c.area === 'post_finish' && c.key === 'caption' && c.kind === 'text'))
  errors.push('Final post caption must be editable');
for (const key of ['workstation_image_update_instruction', 'workstation_image_prompt', 'workstation_video_update_instruction', 'workstation_video_prompt']) {
  if (!controls.some(c => c.area === 'notepad' && c.key === key && c.kind === 'text'))
    errors.push(`Missing actual editable ${key} Notepad field`);
}
const workstationSource = fs.readFileSync('src/EditStory.tsx', 'utf8');
if (!workstationSource.includes('const narrationTabAllowed = pageType === 1 && index % 2 === 0'))
  errors.push('Workstation narration tab must be restricted to Cinema Stage A');
if (!workstationSource.includes('duration > 10') || !workstationSource.includes('Video duration must be 10 seconds or less.'))
  errors.push('Manual scene video upload must enforce the 10-second cap');
if (!controls.some(c => c.area === 'music' && c.key.startsWith('`select_')))
  errors.push('Missing per-song music selection binding');
const storyboardSource = fs.readFileSync('src/Storybook.tsx', 'utf8');
if (!/<AudioPicker\b[^>]*\bforceMusicMode\b/s.test(storyboardSource))
  errors.push('Storyboard background-music picker must expose its song-list controls');
if (!storyboardSource.includes('setactivatevoicenarration={handleNarrationToggle}'))
  errors.push('Storyboard narration toggle must pass through the B-roll reset-warning handler');
const publishLoaderSource = fs.readFileSync('src/PublishLoader.tsx', 'utf8');
const narrationSwitch = publishLoaderSource.match(/<Switch\b[^>]*storybook_studio_selector[^>]*>/s)?.[0] || '';
if (!narrationSwitch || !/onChange=/.test(narrationSwitch) || /onClick=/.test(narrationSwitch))
  errors.push('Narration switch must invoke its handler once per change');
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else if (process.argv.includes('--inventory')) console.log(JSON.stringify(controls));
else console.log(`Creation binding syntax/contracts passed: ${controls.length} bindings in ${files.length} owners. This is not a live execution test.`);
