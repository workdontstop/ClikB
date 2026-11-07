import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Box, Button, Chip, CircularProgress, IconButton, LinearProgress, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import MovieIcon from '@mui/icons-material/Movie';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ReplayIcon from '@mui/icons-material/Replay';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { spatialJobIsActive, spatialRegenerationBlocker, spatialRouteGenerationBlocker, spatialJobDependenciesReady, spatialReadyUpscales, spatialUpscaleIsActive, type SpatialJob, type SpatialUpscale } from '../../server/src/spatialWorld';
import type { SpatialSceneState } from '../spatialStageModel';
import { effectiveSpatialClipPrompt } from '../../server/src/spatialClipPrompt';
import { getVideoModelDisplayName } from '../videoModelCapabilities';
import SpatialNotice from './SpatialNotice';

type Props = {
    scene: SpatialSceneState; darkMode: boolean; accent: string; busy: boolean; glass: any; pill: any; retryPill?: any;
    progressMessage?: string; error?: string; onDismissError: () => void;
    generationSettings?: ReactNode;
    generationSettingsForJob?: (job: SpatialJob) => ReactNode;
    priceForJob?: (job: SpatialJob) => number;
    priceForPair?: (jobs: SpatialJob[], selected: SpatialJob) => number;
    onContinueMapping: () => void;
    onClose: () => void; onGenerate: (routeId?: string) => void; onEdit: (job: SpatialJob) => void;
    onEditMapped: (routeId: string, direction: 'forward' | 'backward') => void;
    onRetry: (jobs: SpatialJob[]) => void; onRegenerate: (job: SpatialJob, scope?: 'direction' | 'both') => void;
    onRetrySaving?: (job: SpatialJob) => void;
    onRecover: (job: SpatialJob) => void;
    onUpscale: (job: SpatialJob) => void; onUseUpscale: (job: SpatialJob, version?: SpatialUpscale) => void;
    onRestore: (job: SpatialJob) => void; onDelete: () => void;
};
export const spatialJobRetryable = (job: SpatialJob) => job.status === 'failed' && !job.output && !job.submissionUncertain && !job.error?.startsWith('Submission uncertain');
export default function SpatialGenerationBoard(props: Props) {
    const { scene, darkMode, accent, busy, glass, pill } = props, ledger = scene.ledger!;
    const [routeId, setRouteId] = useState<string>(), [tab, setTab] = useState<'forward' | 'backward' | 'preview'>('forward');
    const content = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => { if (content.current) content.current.scrollTop = 0; }, [routeId, tab]);
    const routes = Object.values(ledger.routes), route = routeId ? ledger.routes[routeId] : undefined;
    const totalClips = routes.reduce((sum, item) => sum + (item.backward ? 2 : 1), 0);
    const readyClips = ledger.jobs.filter(job => job.status === 'ready').length;
    const jobs = ledger.jobs.filter(job => job.connectionId === routeId);
    const connection = scene.connections.find(edge => edge.id === routeId);
    const motionNumber = routes.findIndex(item => item.connectionId === routeId) + 1;
    const directionName = (job: SpatialJob) => job.direction === 'backward' ? 'Backward' : connection?.kind === 'action' ? 'Action' : 'Forward';
    const statusName = (job: SpatialJob) => job.status === 'waiting-on-parent' || job.status === 'blocked' ? 'Waiting' : job.status === 'checking' ? job.completionError ? 'Needs saving' : 'Saving' : job.status === 'ready' ? 'Saved' : job.status === 'generating' || job.status === 'submitting' ? 'Generating' : job.status === 'preparing' ? 'Preparing' : job.status === 'queued' ? 'Queued' : job.status === 'failed' ? 'Failed' : 'Cancelled';
    const activeJob = spatialJobIsActive;
    const processing = busy || ledger.jobs.some(activeJob);
    const neutralBorder = darkMode ? '#ffffff14' : '#00000018';
    const directionIcon = (job: Pick<SpatialJob, 'direction' | 'kind'>) => job.direction === 'backward' ? <ArrowBackIcon fontSize="small" /> : job.kind === 'action' ? <AutoAwesomeIcon fontSize="small" /> : <ArrowForwardIcon fontSize="small" />;
    const loader = (label: string) => <LinearProgress aria-label={label} sx={{ height: 4, color: accent, bgcolor: `${accent}22`, '& .MuiLinearProgress-bar': { bgcolor: accent } }} />;
    const activeCard = { borderColor: accent, animation: 'spatialMotionGenerating 1.8s ease-in-out infinite', '@keyframes spatialMotionGenerating': { '0%,100%': { boxShadow: `inset 0 0 0 1px ${accent}44` }, '50%': { boxShadow: `inset 0 0 0 2px ${accent}, 0 0 12px ${accent}55` } }, '@media (prefers-reduced-motion: reduce)': { animation: 'none', boxShadow: `inset 0 0 0 2px ${accent}` } };
    const hasResults = jobs.some(job => job.output || job.previousResult);
    const resultKey = jobs.filter(job => job.status === 'ready' && job.output).map(job => `${job.id}:${job.attempt}:${job.output}`).join('|');
    const [seenResults, setSeenResults] = useState<Record<string, string>>({});
    const newResults = Boolean(routeId && resultKey && seenResults[routeId] !== resultKey);
    useEffect(() => { if (tab === 'preview' && routeId && resultKey) setSeenResults(previous => ({ ...previous, [routeId]: resultKey })); }, [tab, routeId, resultKey]);
    const selectedJob = jobs.find(job => job.direction === tab);
    const resolvedOpening = selectedJob && !['waiting-on-parent', 'blocked', 'queued'].includes(selectedJob.status);
    const animation = route && tab !== 'preview' ? route[tab] : undefined;
    const missing = (id: string) => (['forward', 'backward'] as const).some(direction => ledger.routes[id][direction] && !ledger.jobs.some(job => job.id === `${id}:${direction}`));
    const generationBlocked = (id: string) => spatialRouteGenerationBlocker(scene, id);
    const prerequisitesReady = (job: SpatialJob) => spatialJobDependenciesReady(ledger.jobs, job);
    const retryPixels = (job: SpatialJob) => props.priceForJob?.(job) ?? job.pixels;
    const replacementPair = (job: SpatialJob) => connection?.kind !== 'action' && route?.backward ? ledger.jobs.filter(candidate => candidate.connectionId === job.connectionId && (candidate.direction === 'forward' || candidate.direction === 'backward')) : [];
    const prompt = selectedJob ? effectiveSpatialClipPrompt({ ...selectedJob, kind: connection?.kind === 'action' ? 'action' : 'movement' }) : '';
    const panel = { p: 1.25, borderRadius: 3, border: `1px solid ${darkMode ? '#ffffff14' : '#00000012'}`, bgcolor: darkMode ? '#ffffff04' : '#ffffff66' };
    const promptPill = (_text: string, onClick: () => void, disabled: boolean) => <Button aria-label="Edit prompt" startIcon={<EditIcon fontSize="small" />} disabled={disabled} onClick={onClick} sx={{ ...glass, borderColor: neutralBorder, my: 1.25, px: 1.5, py: 1, borderRadius: 999, textTransform: 'none' }}>Edit prompt</Button>;
    const editButton = (job: SpatialJob) => <Button startIcon={<EditIcon />} disabled={busy || ['preparing', 'generating', 'submitting', 'checking'].includes(job.status) || job.submissionUncertain} onClick={() => props.onEdit(job)} sx={{ ...glass, borderColor: neutralBorder, textTransform: 'none', borderRadius: 999 }}>Edit prompt</Button>;
    const jobControls = (job: SpatialJob, inPreview = false) => <Box data-spatial-job-controls={job.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.25 }}>
        {job.status === 'checking' && job.completionError && props.onRetrySaving && <Button aria-label="Retry saving · no new video charge" sx={props.retryPill || pill} disabled={busy} onClick={() => props.onRetrySaving!(job)}>Retry saving · no new video charge</Button>}
        {inPreview && editButton(job)}
        {!inPreview && (job.output || job.previousResult) && <Button startIcon={<MovieIcon />} sx={pill} onClick={() => setTab('preview')}>Review result</Button>}
        {spatialJobRetryable(job) && <Button aria-label={`Retry ${directionName(job).toLowerCase()} · ${retryPixels(job)} P`} startIcon={<ReplayIcon />} sx={props.retryPill || pill} disabled={busy || !prerequisitesReady(job)} title={!prerequisitesReady(job) ? 'Waiting for the previous video.' : undefined} onClick={() => props.onRetry([job])}>Retry · {retryPixels(job)} P</Button>}
        {job.status === 'ready' && job.output && <>
            <Button aria-label={`Regenerate this direction · ${directionName(job).toLowerCase()} · ${retryPixels(job)} P`} startIcon={<RefreshIcon />} sx={props.retryPill || glass} disabled={busy || !prerequisitesReady(job) || Boolean(spatialRegenerationBlocker(ledger.jobs, job))} title={spatialRegenerationBlocker(ledger.jobs, job) || (!prerequisitesReady(job) ? 'Waiting for the previous video.' : undefined)} onClick={() => props.onRegenerate(job, 'direction')}>Regenerate this direction · {retryPixels(job)} P</Button>
            {replacementPair(job).length === 2 && <Button aria-label={`Regenerate both · ${directionName(job).toLowerCase()} settings`} startIcon={<RefreshIcon />} sx={props.retryPill || glass} disabled={busy || replacementPair(job).some(candidate => candidate.status !== 'ready' || !candidate.output || Boolean(spatialRegenerationBlocker(ledger.jobs, candidate)))} onClick={() => props.onRegenerate(job, 'both')}>Regenerate both · {props.priceForPair?.(replacementPair(job), job) ?? replacementPair(job).reduce((total, candidate) => total + retryPixels(candidate), 0)} P</Button>}
        </>}
        {(job.status === 'submitting' || job.submissionUncertain) && <Button disabled={busy} onClick={() => props.onRecover(job)}>Recover request</Button>}
        {inPreview && job.previousResult && ['failed', 'checking', 'ready'].includes(job.status) && <Button disabled={busy || Boolean(spatialRegenerationBlocker(ledger.jobs, { ...job, previousResult: undefined }))} onClick={() => props.onRestore(job)}>Keep previous</Button>}
        {inPreview && job.status === 'ready' && <Button disabled={busy || spatialUpscaleIsActive(job)} onClick={() => props.onUpscale(job)}>{spatialReadyUpscales(job).length ? 'Upscale again' : 'Upscale'}</Button>}
        {inPreview && spatialReadyUpscales(job)[0] && <Button disabled={busy} onClick={() => props.onUseUpscale(job, spatialReadyUpscales(job)[0])}>Use HD</Button>}
    </Box>;
    return <Box role="dialog" aria-label="Spatial generation board" data-spatial-generation-board sx={{ ...glass, borderColor: neutralBorder, bgcolor: darkMode ? '#141414' : '#fafafa', position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxSizing: 'border-box' }}>
        {processing && <Box data-spatial-generation-loader sx={{ flexShrink: 0 }}>{loader(busy ? 'Uploading or preparing motion' : 'Generating scene videos')}</Box>}
        <Box sx={{ p: 1.5, flexShrink: 0 }}>
            <IconButton aria-label={route ? 'Close motion' : 'Close board'} title={route ? 'All motions' : 'Close board'} onClick={() => route ? setRouteId(undefined) : props.onClose()} sx={{ float: 'right', color: 'inherit' }}><CloseIcon /></IconButton>
            <Typography variant="h6" sx={{ pr: 5, fontSize: '1.1rem' }}>Motion videos</Typography>
            <Typography variant="caption">{`${readyClips} / ${totalClips}${ledger.jobs.length && new Set(ledger.jobs.map(job => job.model)).size === 1 ? ` · ${getVideoModelDisplayName(ledger.jobs[0].model)}` : ''}`}</Typography>
            {!processing && <Button startIcon={<EditNoteIcon />} sx={{ ...glass, textTransform: 'none', borderRadius: 999, display: 'flex', mt: 1 }} onClick={props.onContinueMapping}>Continue mapping</Button>}
            {!!ledger.jobs.length && !processing && <LinearProgress aria-label="Scene videos ready" variant="determinate" value={totalClips ? readyClips / totalClips * 100 : 0} sx={{ mt: 1, color: accent, bgcolor: `${accent}22`, '& .MuiLinearProgress-bar': { bgcolor: accent } }} />}
            {props.generationSettings && <Box sx={{ mt: 1.5 }}>{props.generationSettings}</Box>}
            {route && <>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, gap: 1 }}><Button size="small" startIcon={<ArrowBackIcon />} onClick={() => setRouteId(undefined)}>All motions</Button><Typography variant="subtitle2">Motion {motionNumber}</Typography></Box>
                <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="fullWidth" aria-label="Motion direction and results" sx={{ mt: .5, minHeight: 44, '& .MuiTab-root': { minWidth: 0, px: .5, fontSize: '.72rem', minHeight: 44, textTransform: 'none' } }}>
                    <Tab value="forward" aria-label={connection?.kind === 'action' ? 'Action' : 'Forward'} title={connection?.kind === 'action' ? 'Action' : 'Forward'} icon={connection?.kind === 'action' ? <AutoAwesomeIcon /> : <ArrowForwardIcon />} />
                    {route.backward && <Tab value="backward" aria-label="Backward" title="Backward" icon={<ArrowBackIcon />} />}
                    <Tab value="preview" aria-label="Results" title="Results" icon={<Box sx={{ position: 'relative', display: 'flex' }}><MovieIcon />{newResults && <Box data-spatial-new-result sx={{ position: 'absolute', right: -4, top: -2, width: 6, height: 6, borderRadius: '50%', bgcolor: accent }} />}</Box>} sx={hasResults ? { color: accent } : {}} />
                </Tabs>
            </>}
        </Box>
        <Box ref={content} data-spatial-board-content sx={{ p: 1.5, pt: 0, flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {props.error && <SpatialNotice darkMode={darkMode} accent={accent} onClose={props.onDismissError}>{props.error}</SpatialNotice>}
            {!route && <>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(125px,1fr))', gap: 1 }}>
                    {routes.map((item, index) => <Box key={item.connectionId} data-spatial-motion-card={item.connectionId} data-spatial-generating={ledger.jobs.some(job => job.connectionId === item.connectionId && activeJob(job)) ? 'true' : 'false'} sx={{ ...glass, borderColor: neutralBorder, ...(ledger.jobs.some(job => job.connectionId === item.connectionId && activeJob(job)) ? activeCard : {}), p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}><Button aria-label={`Motion ${index + 1} · ${item.backward ? 'Movement' : 'Action'}`} onClick={() => { setRouteId(item.connectionId); setTab('forward'); }} sx={{ p: .5, borderRadius: 2, display: 'flex', flexDirection: 'column', textTransform: 'none', color: 'inherit', gap: .5, flex: 1 }}>
                        <Box sx={{ position: 'relative', width: '100%' }}><Box component="img" src={item.forward.endAnchor || item.forward.startAnchor} alt="" sx={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 2 }} />{ledger.jobs.some(job => job.connectionId === item.connectionId && activeJob(job)) && <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', bgcolor: '#00000055', borderRadius: 2 }}><CircularProgress aria-label={`Generating Motion ${index + 1}`} disableShrink size={28} sx={{ color: accent }} /></Box>}</Box>
                        <Typography variant="body2">Motion {index + 1}</Typography>
                        {ledger.jobs.filter(job => job.connectionId === item.connectionId).map(job => <Tooltip key={job.id} title={job.direction === 'backward' ? 'Backward' : item.backward ? 'Forward' : 'Action'}><Typography aria-label={`${job.direction === 'backward' ? 'Backward' : item.backward ? 'Forward' : 'Action'} · ${statusName(job)} · ${job.pixels} P`} role={activeJob(job) ? 'status' : undefined} variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: .4, ...(activeJob(job) ? { color: accent, fontWeight: 850 } : {}) }}>{directionIcon(job)}{statusName(job)} · {job.pixels} P</Typography></Tooltip>)}
                    </Button>{missing(item.connectionId) && <Button aria-label={`Generate Motion ${index + 1}`} disabled={busy || Boolean(generationBlocked(item.connectionId))} title={generationBlocked(item.connectionId)} sx={pill} onClick={() => props.onGenerate(item.connectionId)}>{generationBlocked(item.connectionId) ? 'Waiting' : 'Generate'}</Button>}
                    {ledger.jobs.filter(job => job.connectionId === item.connectionId && spatialJobRetryable(job)).map(job => <Button key={job.id} aria-label={`Retry Motion ${index + 1} ${job.direction}`} startIcon={directionIcon(job)} disabled={busy || !prerequisitesReady(job)} sx={props.retryPill || pill} onClick={() => props.onRetry([job])}>Retry · {retryPixels(job)} P</Button>)}
                    {ledger.jobs.filter(job => job.connectionId === item.connectionId && job.status === 'checking' && job.completionError).map(job => <Button key={`saving:${job.id}`} aria-label={`Retry saving Motion ${index + 1} · no new video charge`} disabled={busy || !props.onRetrySaving} sx={props.retryPill || pill} onClick={() => props.onRetrySaving?.(job)}>Retry saving · no new video charge</Button>)}
                    </Box>)}
                </Box>
            </>}
            {route && tab !== 'preview' && animation && <>
                {selectedJob && <Chip size="small" label={`${statusName(selectedJob)} · ${selectedJob.pixels} P`} sx={{ mb: 1 }} />}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 1 }}>
                <Box sx={panel}>
                <Box sx={{ display: 'flex', gap: 1, my: 1, overflowX: 'auto' }}>
                    <Tooltip title="Opening frame"><Box sx={{ width: tab === 'backward' && resolvedOpening ? '48%' : '100%', flexShrink: 0 }}><Box component="img" src={resolvedOpening ? selectedJob!.startAnchor : ledger.world.sourceImage} alt={resolvedOpening ? '2D appearance / start' : 'Scene appearance; opening frame pending'} sx={{ width: '100%', height: 150, objectFit: 'contain', borderRadius: 2 }} /></Box></Tooltip>
                    {tab === 'backward' && resolvedOpening && <Tooltip title="Return destination"><Box sx={{ width: '48%', flexShrink: 0 }}><Box component="img" src={selectedJob!.endAnchor} alt="2D return destination" sx={{ width: '100%', height: 150, objectFit: 'contain', borderRadius: 2 }} /></Box></Tooltip>}
                    {(selectedJob?.references || animation.references || ledger.world.references || []).map(ref => <Box component="img" key={ref.name} src={ref.imageUrl} alt={ref.name} sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '50%', flexShrink: 0 }} />)}
                </Box>
                </Box>
                <Box sx={panel}>
                {animation.referenceVideo ? <video aria-label="Three.js motion reference" key={`${routeId}:${tab}:ref`} src={animation.referenceVideo} controls preload="metadata" style={{ width: '100%', height: 150, objectFit: 'contain', borderRadius: 8, marginTop: 8 }} /> : <Typography variant="caption" sx={{ my: 1 }}>Reference pending</Typography>}
                </Box>
                </Box>
                {selectedJob ? <>
                    {promptPill(prompt, () => props.onEdit(selectedJob), busy || ['preparing', 'generating', 'submitting', 'checking'].includes(selectedJob.status) || Boolean(selectedJob.submissionUncertain))}
                    {selectedJob.error && <SpatialNotice darkMode={darkMode} accent={accent}>{selectedJob.error}</SpatialNotice>}
                    {props.generationSettingsForJob && <Box sx={{ mt: 1 }}>{props.generationSettingsForJob(selectedJob)}</Box>}
                    {jobControls(selectedJob)}
                </> : <>
                    {promptPill(effectiveSpatialClipPrompt({ ...animation, direction: tab === 'backward' ? 'backward' : 'forward', kind: connection?.kind === 'action' ? 'action' : 'movement' }), () => props.onEditMapped(routeId!, tab === 'backward' ? 'backward' : 'forward'), busy)}
                    <Button fullWidth sx={{ ...pill, mt: 1 }} disabled={busy || Boolean(generationBlocked(routeId!))} title={generationBlocked(routeId!)} onClick={() => props.onGenerate(routeId)}>{generationBlocked(routeId!) ? 'Waiting' : 'Generate'}</Button>
                </>}
            </>}
            {route && tab === 'preview' && <>
                {jobs.map(job => <Box key={job.id} data-spatial-result={job.direction} sx={{ mb: 2, p: 1.25, border: `1px solid ${neutralBorder}`, borderRadius: 2.5 }}>
                    <Typography aria-label={`${directionName(job)} · ${statusName(job)}`} variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: .75 }}>{directionIcon(job)}{statusName(job)}</Typography>
                    {activeJob(job) && <Box sx={{ my: 1 }}>{loader(`${directionName(job)} ${statusName(job).toLowerCase()}`)}</Box>}
                    {job.output && <video src={job.output} controls preload="metadata" style={{ width: '100%', maxHeight: 320 }} />}
                    {job.previousResult && <Box component="details" open={!job.output || undefined} sx={{ my: 1 }}><Box component="summary" sx={{ cursor: 'pointer', fontSize: '.75rem' }}>Previous</Box><video src={job.previousResult.output} controls preload="metadata" style={{ width: '100%', maxHeight: 280 }} /></Box>}
                    {!!job.resultHistory?.length && <Box component="details" sx={{ my: 1 }}><Box component="summary" sx={{ cursor: 'pointer', fontSize: '.75rem' }}>Earlier versions ({job.resultHistory.length})</Box>{job.resultHistory.map((version, index) => <video key={`${index}:${version.output}`} src={version.output} controls preload="none" style={{ width: '100%', maxHeight: 240 }} />)}</Box>}
                    {job.error && <SpatialNotice darkMode={darkMode} accent={accent}>{job.error}</SpatialNotice>}
                    {job.upscale?.output && <><Typography variant="caption">HD version</Typography><video src={job.upscale.output} controls preload="metadata" style={{ width: '100%', maxHeight: 280 }} /></>}
                    {!!job.upscaleHistory?.some(item => item.output) && <Box component="details" sx={{ my: 1 }}><Box component="summary" sx={{ cursor: 'pointer', fontSize: '.75rem' }}>Earlier HD versions</Box>{job.upscaleHistory.filter(item => item.output).slice().reverse().map((version, index) => <Box key={`${version.submissionToken || index}:${version.output}`}><Typography variant="caption">{version.resolution === '2k' ? '2K' : '1080p'} · {version.pixels} P</Typography><video src={version.output} controls preload="none" style={{ width: '100%', maxHeight: 240 }} /><Button disabled={busy} onClick={() => props.onUseUpscale(job, version)}>Use this HD version</Button></Box>)}</Box>}
                    {job.upscale?.error && <SpatialNotice darkMode={darkMode} accent={accent}>{job.upscale.error}</SpatialNotice>}
                    {props.generationSettingsForJob && <Box sx={{ mt: 1.5 }}>{props.generationSettingsForJob(job)}</Box>}
                    {jobControls(job, true)}
                </Box>)}
            </>}
            {route && ledger.generationStarted && <Box component="details" sx={{ mt: 3 }}><Box component="summary" sx={{ fontSize: '.75rem', opacity: .65, cursor: 'pointer' }}>Manage</Box><Button color="error" onClick={props.onDelete} sx={{ mt: 1 }}>Delete scene videos…</Button></Box>}
        </Box>
        {!route && routes.some(item => missing(item.connectionId)) && <Box sx={{ p: 1.5, borderTop: `1px solid ${accent}33`, flexShrink: 0 }}><Button fullWidth sx={pill} disabled={busy} onClick={() => props.onGenerate()}>Generate all</Button></Box>}
    </Box>;
}
