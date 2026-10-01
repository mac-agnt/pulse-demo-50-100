import { Fragment } from "react";
import { arr, css, cx, txt } from "../../runtime/template";
import HomeThread from "./HomeThread";
import HomeWidgetRail from "./HomeWidgetRail";

type Props = { v: any };

export default function Home({ v }: Props) {
  return (
    <>
      <div style={{"position":"relative","display":"flex","gap":"20px","height":"100%","padding":"0 22px 22px"}}>
        <div style={css(v.homeCanvasStyle)} />
        <div style={css(v.chatColumnStyle)}>
          {v.heliosEmpty && (
            <>
              <div style={{"flex":"1 1 0","minHeight":"0"}} />
            </>
          )}
          <div style={css(v.chatScrollStyle)}>
            {v.heliosEmpty && (
              <>
                <div style={{"flex":"0 0 auto","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"flex-end","textAlign":"center","padding":"clamp(4px,1.2vh,14px) 8px clamp(20px,3.2vh,34px)"}}>
                  <button className="ixf" onClick={v.goApprovals} style={{"display":"inline-flex","alignItems":"center","gap":"9px","height":"30px","padding":"0 6px 0 11px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,11px)","background":"var(--surface-faint)","backdropFilter":"blur(18px) saturate(1.25)","fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.16em","color":"var(--dim)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease),background .2s var(--ease)"}}>
                    <span style={{"width":"5px","height":"5px","flex":"none","borderRadius":"2px","background":"var(--accent)","boxShadow":"0 0 8px var(--accent)","animation":"breathe 2.8s ease-in-out infinite"}} />
                    <span style={{"minWidth":"0","whiteSpace":"nowrap","overflow":"hidden","textOverflow":"ellipsis"}}>
                      {txt(v.approvalsPill)}
                    </span>
                    <span style={{"flex":"none","display":"flex","alignItems":"center","justifyContent":"center","width":"20px","height":"20px","borderRadius":"var(--cta-r,7px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h13 M13 6.5 18.5 12 13 17.5" />
                      </svg>
                    </span>
                  </button>
                  <h1 style={{"margin":"14px 0 0","maxWidth":"16ch","display":"flex","flexWrap":"wrap","alignItems":"baseline","justifyContent":"center","gap":"8px 14px","fontSize":"clamp(28px,4.6vh,48px)","fontWeight":"500","letterSpacing":"-1px","lineHeight":"1"}}>
                    <span style={{"color":"var(--ink)"}}>
                      {txt(v.greetingPrefix)}
                    </span>
                    <span style={{"color":"var(--accent)"}}>
                      {txt(v.greetingName)}
                    </span>
                  </h1>
                  <div style={{"marginTop":"10px","fontSize":"13px","color":"var(--dim)","textWrap":"pretty"}}>
                    {txt(v.homeSubline)}
                  </div>
                </div>
              </>
            )}
            {v.threadOpen && <HomeThread v={v} />}
          </div>
          <div style={{"flex":"none","paddingTop":"14px"}}>
            <div style={css(v.composerWidthStyle)}>
              <div className="ixi" style={css(v.composerShellStyle)}>
                <div style={{"display":"flex","alignItems":"flex-end","gap":"10px","padding":"9px 9px 9px 17px"}}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none","marginBottom":"9px"}}>
                    <path d="M21.4 11.05 12.25 20.2a5 5 0 0 1-7.07-7.07l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78" />
                  </svg>
                  <textarea value={v.draft ?? ""} onChange={v.setDraft} onKeyDown={v.onDraftKey} rows={1} placeholder="Ask Pulse anything…" style={{"flex":"1","minWidth":"0","border":"0","outline":"0","resize":"none","background":"none","fontSize":"15px","lineHeight":"1.55","padding":"7px 0","maxHeight":"120px","overflowY":"hidden","scrollbarWidth":"none","textOverflow":"ellipsis"}} />
                  <button className={cx("ixj", "ixk")} onClick={v.send} style={{"flex":"none","width":"34px","height":"34px","border":"0","borderRadius":"var(--cta-r,12px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"transform .2s var(--ease),box-shadow .24s var(--ease),background .2s var(--ease)"}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5 M5 12l7-7 7 7" />
                    </svg>
                  </button>
                </div>
                {v.heliosEmpty && (
                  <>
                    <div style={{"display":"flex","flexWrap":"wrap","alignItems":"center","gap":"2px","padding":"6px 8px","borderTop":"1px solid var(--border)","background":"var(--surface-faint)"}}>
                      {arr(v.composerTools).map((t: any, i14: number) => (
                        <Fragment key={i14}>
                          <button className="ixl" onClick={t?.go} style={{"display":"flex","alignItems":"center","gap":"7px","height":"28px","padding":"0 11px","border":"0","borderRadius":"var(--r-ctl,10px)","background":"none","color":"var(--dim)","fontSize":"12px","cursor":"pointer","whiteSpace":"nowrap","transition":"background .18s var(--ease),color .18s var(--ease)"}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none","opacity":".85"}}>
                              <path d={t?.icon} />
                            </svg>
                            {"\n"}
                            {txt(t?.label)}
                          </button>
                        </Fragment>
                      ))}
                      <span style={{"flex":"1","minWidth":"6px"}} />
                      <button className="ixl" onClick={v.openPalette} style={{"display":"flex","alignItems":"center","gap":"7px","height":"28px","padding":"0 11px","border":"0","borderRadius":"var(--r-ctl,10px)","background":"none","color":"var(--faint)","fontSize":"12px","cursor":"pointer","whiteSpace":"nowrap","transition":"background .18s var(--ease),color .18s var(--ease)"}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{"opacity":".85"}}>
                          <path d="m21 21-4.3-4.3 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0" />
                        </svg>
                        {"\nSearch everything"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {v.heliosEmpty && (
            <>
              <div style={{"flex":"1 1 0","minHeight":"0"}} />
            </>
          )}
        </div>
        {v.showRail && <HomeWidgetRail v={v} />}
      </div>
    </>
  );
}
