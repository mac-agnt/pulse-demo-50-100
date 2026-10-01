import { cx, txt } from "../../runtime/template";

type Props = { v: any };

export default function AgentStudioPrompt({ v }: Props) {
  return (
    <>
      <div style={{"display":"flex","alignItems":"center","gap":"10px","marginTop":"24px"}}>
        <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
          {"PINNED SYSTEM PROMPT"}
        </span>
        <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
        <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
          {txt(v.sysMeta)}
        </span>
      </div>
      <div style={{"position":"relative","marginTop":"11px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px)"}}>
        <div style={{"display":"flex","alignItems":"center","gap":"9px","padding":"11px 15px","borderBottom":"1px solid var(--border)"}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
            <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
            <path d="M14 3v5h5" />
          </svg>
          <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
            {"prompt.md"}
          </span>
          <span style={{"flex":"none","width":"3px","height":"3px","borderRadius":"2px","background":"var(--track)"}} />
          <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
            {txt(v.sysLines)}
          </span>
          <span style={{"flex":"none","width":"3px","height":"3px","borderRadius":"2px","background":"var(--track)"}} />
          <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
            {txt(v.sysTokens)}
          </span>
          <span style={{"flex":"1"}} />
          {v.sysClean && (
            <>
              <span style={{"display":"flex","alignItems":"center","gap":"7px","flex":"none"}}>
                <span style={{"width":"5px","height":"5px","borderRadius":"50%","background":"var(--accent)","opacity":".8"}} />
                <span style={{"fontSize":"11.5px","color":"var(--faint)","whiteSpace":"nowrap"}}>
                  {"Saved with the agent"}
                </span>
              </span>
            </>
          )}
          {v.sysEdited && (
            <>
              <span style={{"display":"flex","alignItems":"center","gap":"7px","flex":"none"}}>
                <span style={{"width":"5px","height":"5px","borderRadius":"50%","background":"var(--accent)","boxShadow":"0 0 7px var(--accent)","animation":"breathe 1.6s ease-in-out infinite"}} />
                <span style={{"fontSize":"11.5px","color":"var(--body)","whiteSpace":"nowrap"}}>
                  {"Edited · next run"}
                </span>
              </span>
              <button className="ixm" onClick={v.revertPrompt} style={{"flex":"none","height":"24px","padding":"0 10px","border":"1px solid var(--border)","borderRadius":"8px","background":"none","fontSize":"11.5px","color":"var(--dim)","cursor":"pointer","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                {"Revert"}
              </button>
            </>
          )}
        </div>
        <textarea className="ix1b" value={v.sysPrompt ?? ""} onChange={v.setSysPrompt} spellCheck="false" style={{"display":"block","width":"100%","minHeight":"320px","padding":"18px 20px 92px","background":"none","border":"0","outline":"0","resize":"none","fontFamily":"var(--mono)","fontSize":"12px","lineHeight":"1.75","color":"var(--body)","transition":"color .2s var(--ease)"}} />
        <div style={{"position":"absolute","left":"0","right":"0","bottom":"0","height":"104px","borderRadius":"0 0 18px 18px","background":"linear-gradient(180deg,transparent,var(--surface-strong) 62%)","pointerEvents":"none"}} />
        <div className="ix1c" style={{"position":"absolute","left":"18px","right":"18px","bottom":"16px","display":"flex","alignItems":"center","gap":"10px","height":"52px","padding":"0 8px 0 16px","borderRadius":"26px","background":"var(--surface-strong)","border":"1px solid var(--border-strong)","boxShadow":"0 18px 44px var(--glass-shadow),0 2px 0 var(--glass-highlight) inset","backdropFilter":"blur(28px) saturate(1.3)","transition":"border-color .24s var(--ease),box-shadow .24s var(--ease)"}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
            <path d="M12 3.5 13.6 8 18 9.6 13.6 11.2 12 15.7 10.4 11.2 6 9.6 10.4 8Z" />
            <path d="M18.5 15.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" />
          </svg>
          <input value={v.tuneDraft ?? ""} onChange={v.setTuneDraft} onKeyDown={v.onTuneKey} placeholder="Ask for a change — “stop mentioning margin”" style={{"flex":"1","minWidth":"0","height":"100%","border":"0","outline":"0","background":"none","fontSize":"13.5px","color":"var(--ink)"}} />
          <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"8.5px","letterSpacing":"0.1em","color":"var(--faint)","whiteSpace":"nowrap"}}>
            {"↵ SEND"}
          </span>
          <button className={cx("ix1d", "ixo")} onClick={v.sendTune} title="Send" style={{"flex":"none","width":"38px","height":"38px","border":"0","borderRadius":"var(--cta-r,19px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"0 6px 18px var(--accent-soft)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"transform .18s var(--ease),box-shadow .2s var(--ease)"}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5 M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
