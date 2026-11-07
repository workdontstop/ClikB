import { IconButton, Tooltip } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
/** Outside every hidden chrome group; visibility belongs to the host. */
export default function SceneControlsToggle({hidden,onToggle}: {hidden:boolean;onToggle:()=>void}) {
 const label=hidden?'Show scene controls':'Hide scene controls';
 return <div data-scene-controls-toggle style={{position:'absolute',top:'max(10px, env(safe-area-inset-top, 0px))',left:10,zIndex:140,pointerEvents:'auto'}}>
  <Tooltip title={label}><IconButton aria-label={label} aria-pressed={hidden} onClick={onToggle} sx={{width:40,height:32,borderRadius:8,p:0,color:'#fff',bgcolor:'rgba(12,20,32,.65)',border:'1px solid rgba(255,255,255,.3)','&:hover':{bgcolor:'rgba(12,20,32,.8)'}}}>{hidden?<ArrowDropUpIcon/>:<ArrowDropDownIcon/>}</IconButton></Tooltip>
 </div>;
}
