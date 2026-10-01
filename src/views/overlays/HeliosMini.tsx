import { Fragment } from "react";
import { arr, cat, css, cx, txt } from "../../runtime/template";

type Props = { v: any };

export default function HeliosMini({ v }: Props) {
  return (
    <>
      <div style={{"position":"fixed","right":"26px","bottom":"96px","zIndex":"46","width":"min(392px,88vw)","maxHeight":"min(580px,74vh)","display":"flex","flexDirection":"column","background":"var(--overlay)","border":"1px solid var(--border-strong)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(48px) saturate(1.5)","boxShadow":"var(--card-shadow),0 30px 72px rgba(0,0,0,.5)","overflow":"hidden","animation":"panelIn .38s cubic-bezier(.16,1,.3,1) both"}}>
        <span style={{"position":"absolute","inset":"0","borderRadius":"var(--card-r,18px)","pointerEvents":"none","boxShadow":"inset 0 1px 0 var(--glass-highlight),inset 0 0 0 1px rgba(255,255,255,.03)"}} />
        <span style={{"position":"absolute","left":"-20%","top":"-30%","width":"90%","height":"70%","pointerEvents":"none","filter":"blur(58px)","opacity":".5","background":"var(--glow-a)","borderRadius":"var(--r-sm,9px)"}} />
        <div style={{"position":"relative","flex":"none","display":"flex","alignItems":"center","gap":"10px","padding":"13px 14px","borderBottom":"1px solid var(--border)"}}>
          <span style={{"width":"28px","height":"28px","flex":"none","borderRadius":"var(--r-sm,10px)","background":"var(--accent-soft)","border":"1px solid var(--accent-line)","display":"flex","alignItems":"center","justifyContent":"center"}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h4l2.5-6 3.5 12 3-8 2 2h5" />
            </svg>
          </span>
          <div style={css(v.miniTabTrack)}>
            <span style={css(v.miniTabThumb)} />
            {arr(v.miniTabs).map((t: any, i115: number) => (
              <Fragment key={i115}>
                <button onClick={t?.pick} style={css(t?.style)}>
                  {txt(t?.label)}
                </button>
              </Fragment>
            ))}
          </div>
          <div style={{"flex":"1","minWidth":"4px"}} />
          <button className="ixm" onClick={v.goHomeChat} title="Open full conversation" style={{"width":"28px","height":"28px","flex":"none","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,10px)","background":"none","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5h10v10 M19 5 6 18" />
            </svg>
          </button>
        </div>
        {v.miniIsChat && (
          <>
            <div style={{"flex":"1","minHeight":"0","overflowY":"auto","padding":"16px"}}>
              {arr(v.miniThread).map((m: any, i116: number) => (
                <Fragment key={i116}>
                  <div style={css(m?.wrapStyle)}>
                    <div style={css(m?.bubbleStyle)}>
                      {txt(m?.text)}
                    </div>
                  </div>
                </Fragment>
              ))}
              {v.miniEmpty && (
                <>
                  <div style={{"padding":"4px 2px"}}>
                    <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.14em","color":"var(--faint)"}}>
                      {txt(v.miniContext)}
                    </div>
                    <div style={{"fontSize":"21px","fontWeight":"500","letterSpacing":"-.5px","marginTop":"9px","lineHeight":"1.2"}}>
                      {txt(v.miniGreeting)}
                    </div>
                    <div style={{"fontSize":"12.5px","color":"var(--dim)","marginTop":"6px","lineHeight":"1.5","textWrap":"pretty"}}>
                      {"Reads what you can see. Ask about this page, or pick one of these."}
                    </div>
                    <div style={{"display":"flex","flexDirection":"column","gap":"7px","marginTop":"14px"}}>
                      {arr(v.miniSuggestions).map((s: any, i117: number) => (
                        <Fragment key={i117}>
                          <button className="ix19" onClick={s?.run} style={{"display":"flex","alignItems":"center","gap":"9px","width":"100%","padding":"10px 13px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-sm,11px)","fontSize":"12.5px","color":"var(--body)","textAlign":"left","cursor":"pointer","transition":"border-color .2s var(--ease),background .2s var(--ease),transform .18s var(--ease)"}}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
                              <path d="M5 12h13 M13 6.5 18.5 12 13 17.5" />
                            </svg>
                            <span style={{"flex":"1","minWidth":"0"}}>
                              {txt(s?.label)}
                            </span>
                          </button>
                        </Fragment>
                      ))}
                    </div>
                    {v.miniHasRecent && (
                      <>
                        <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)","marginTop":"18px"}}>
                          {"RECENT CHATS"}
                        </div>
                        {arr(v.miniRecent).map((r: any, i118: number) => (
                          <Fragment key={i118}>
                            <button onClick={r?.open} style={{"width":"100%","display":"flex","alignItems":"center","gap":"9px","padding":"10px 0","borderTop":"1px solid var(--border)","borderLeft":"0","borderRight":"0","borderBottom":"0","background":"none","cursor":"pointer","textAlign":"left"}}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
                                <path d="M4 5h16v11H8l-4 4V5Z" />
                              </svg>
                              <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","color":"var(--ink)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                                {txt(r?.title)}
                              </span>
                              <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--faint)"}}>
                                {txt(r?.date)}
                              </span>
                            </button>
                          </Fragment>
                        ))}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
            <div style={{"position":"relative","flex":"none","padding":"10px 12px 13px"}}>
              <div className="ixi" style={{"display":"flex","alignItems":"center","gap":"7px","padding":"6px 6px 6px 7px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","transition":"border-color .22s var(--ease),box-shadow .3s var(--ease)"}}>
                <button className="ixm" onClick={v.miniAttach} title="Attach a record or file" style={{"width":"34px","height":"34px","flex":"none","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,12px)","background":"none","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14 M5 12h14" />
                  </svg>
                </button>
                <input value={v.miniDraft ?? ""} onChange={v.setMiniDraft} onKeyDown={v.onMiniKey} placeholder="Ask your business anything" style={{"flex":"1","minWidth":"0","border":"0","outline":"0","background":"none","fontSize":"13.5px","color":"var(--ink)"}} />
                <button onClick={v.miniDictate} title="Dictate" style={css(v.miniMicStyle)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z M6 11a6 6 0 0 0 12 0 M12 17v3" />
                  </svg>
                </button>
                <button className={cx("ix1a", "ix1")} onClick={v.sendMini} title="Send" style={{"width":"34px","height":"34px","flex":"none","border":"0","borderRadius":"var(--cta-r,12px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"transform .18s var(--ease),box-shadow .22s var(--ease)"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5 M5 12l7-7 7 7" />
                  </svg>
                </button>
              </div>
              <div style={{"display":"flex","alignItems":"center","gap":"7px","padding":"9px 6px 0","fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.1em","color":"var(--faint)"}}>
                <span style={{"width":"5px","height":"5px","borderRadius":"2px","background":"var(--accent)","animation":"breathe 2.6s ease-in-out infinite"}} />
                <span>
                  {txt(v.miniFooter)}
                </span>
              </div>
            </div>
          </>
        )}
        {v.miniIsWork && (
          <>
            <div style={{"flex":"1","minHeight":"0","overflowY":"auto","padding":"14px 14px 16px","display":"flex","flexDirection":"column","gap":"10px"}}>
              {arr(v.miniWorkSections).map((sec: any, i119: number) => (
                <Fragment key={i119}>
                  <div style={css(sec?.wrapStyle)}>
                    <button onClick={sec?.toggle} style={{"width":"100%","display":"flex","alignItems":"center","gap":"9px","padding":"13px 14px","background":"none","border":"0","cursor":"pointer","textAlign":"left"}}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
                        <path d={sec?.icon} />
                      </svg>
                      <span style={{"fontFamily":"var(--mono)","fontSize":"10.5px","letterSpacing":"0.1em","color":"var(--faint)"}}>
                        {txt(sec?.num)}
                      </span>
                      <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","fontWeight":"500","letterSpacing":"0.02em","textTransform":"uppercase"}}>
                        {txt(sec?.title)}
                      </span>
                      <span style={css(cat("font-size:11.5px;color:", sec?.statusColor, ";display:flex;align-items:center;gap:6px"))}>
                        <span style={css(cat("width:5px;height:5px;border-radius:2px;background:", sec?.statusColor))} />
                        {txt(sec?.statusText)}
                      </span>
                    </button>
                    {sec?.open && (
                      <>
                        <div style={{"padding":"0 14px 14px","animation":"expandIn .24s var(--ease) both"}}>
                          {sec?.isEmpty && (
                            <>
                              <div style={{"padding":"26px 0 6px","textAlign":"center"}}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{"margin":"0 auto"}}>
                                  <path d={sec?.icon} />
                                </svg>
                                <div style={{"fontSize":"12.5px","color":"var(--dim)","marginTop":"9px"}}>
                                  {txt(sec?.emptyText)}
                                </div>
                              </div>
                            </>
                          )}
                          {arr(sec?.rows).map((r: any, i120: number) => (
                            <Fragment key={i120}>
                              <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"9px 0","borderTop":"1px solid var(--border)"}}>
                                {r?.isCheck && (
                                  <>
                                    <span style={{"width":"16px","height":"16px","flex":"none","borderRadius":"6px","border":"1.5px solid var(--border-strong)"}} />
                                  </>
                                )}
                                <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","lineHeight":"1.4"}}>
                                  {txt(r?.title)}
                                </span>
                                {r?.hasTag && (
                                  <>
                                    <span style={css(r?.tagStyle)}>
                                      {txt(r?.tag)}
                                    </span>
                                  </>
                                )}
                              </div>
                            </Fragment>
                          ))}
                          {sec?.hasLink && (
                            <>
                              <button className="ix3" onClick={sec?.linkGo} style={{"display":"flex","alignItems":"center","gap":"6px","marginTop":"12px","background":"none","border":"0","padding":"0","color":"var(--dim)","fontSize":"12.5px","cursor":"pointer"}}>
                                {txt(sec?.linkLabel)}
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M7 17 17 7 M8 7h9v9" />
                                </svg>
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </Fragment>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
