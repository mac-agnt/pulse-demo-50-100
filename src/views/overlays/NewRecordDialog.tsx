import { Fragment } from "react";
import { arr, cat, css, cx, txt } from "../../runtime/template";

type Props = { v: any };

export default function NewRecordDialog({ v }: Props) {
  return (
    <>
      <div onClick={v.newRec?.close} style={{"position":"fixed","inset":"0","zIndex":"74","background":"rgba(6,10,8,.38)","backdropFilter":"blur(22px)","display":"flex","alignItems":"flex-start","justifyContent":"center","padding":"9vh 16px 4vh","overflowY":"auto"}}>
        <div style={{"position":"absolute","left":"0","top":"0","right":"0","height":"78%","background":"var(--hero-grad)","opacity":".72","filter":"blur(1px)","WebkitMaskImage":"linear-gradient(180deg,#000 0%,#000 60%,transparent 100%)","maskImage":"linear-gradient(180deg,#000 0%,#000 60%,transparent 100%)","pointerEvents":"none"}} />
        <div onClick={v.stop} style={{"position":"relative","width":"min(760px,100%)","background":"rgba(18,24,20,.52)","border":"1px solid rgba(255,255,255,.14)","borderRadius":"var(--card-r,18px)","boxShadow":"0 40px 90px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.1)","backdropFilter":"blur(46px) saturate(1.7)","overflow":"hidden","animation":"glassIn .2s var(--ease) both"}}>
          <div style={{"position":"relative","display":"flex","alignItems":"center","gap":"12px","padding":"22px 26px","borderBottom":"1px solid var(--border)"}}>
            <div style={{"flex":"1","minWidth":"0"}}>
              <div style={{"fontSize":"19px","fontWeight":"600","letterSpacing":"-.4px","color":"var(--ink)"}}>
                {"New record"}
              </div>
              <div style={{"fontFamily":"var(--mono)","fontSize":"10px","letterSpacing":"0.1em","color":"var(--dim)","marginTop":"5px"}}>
                {"NAME IT, THEN PICK HOW IT READS"}
              </div>
            </div>
            <button className={cx("ix1e", "ix1f")} onClick={v.newRec?.close} aria-label="Close" style={{"flex":"none","width":"30px","height":"30px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,11px)","background":"var(--chip)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .16s var(--ease),border-color .16s var(--ease),transform .16s var(--ease)"}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12 M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div style={{"position":"relative","padding":"22px 26px 6px"}}>
            <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.12em","color":"var(--dim)"}}>
              {"RECORD NAME"}
            </div>
            <input className="ix1g" value={v.newRec?.name ?? ""} onChange={v.newRec?.setName} placeholder="Casey Builders — 2026 framework" style={{"width":"100%","marginTop":"10px","padding":"12px 15px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-md,12px)","outline":"0","fontSize":"14.5px","color":"var(--ink)","boxShadow":"inset 0 1px 2px rgba(0,0,0,.2)","transition":"border-color .16s var(--ease),box-shadow .16s var(--ease)"}} />
            <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.12em","color":"var(--dim)","marginTop":"22px"}}>
              {"HOW THE DATA IS DISPLAYED"}
            </div>
            <div style={{"display":"flex","flexWrap":"nowrap","alignItems":"center","gap":"2px","marginTop":"12px","padding":"3px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"6px","width":"fit-content","maxWidth":"100%","overflowX":"auto"}}>
              {arr(v.newRec?.cats).map((c: any, i146: number) => (
                <Fragment key={i146}>
                  <button onClick={c?.pick} style={css(c?.style)}>
                    {txt(c?.label)}
                  </button>
                </Fragment>
              ))}
            </div>
            <div style={{"display":"grid","gridTemplateColumns":"repeat(3,1fr)","gap":"12px","marginTop":"14px","maxHeight":"400px","overflowY":"auto","paddingBottom":"2px"}}>
              {arr(v.newRec?.templates).map((t: any, i147: number) => (
                <Fragment key={i147}>
                  <button onClick={t?.pick} style={css(t?.style)}>
                    <div style={css(t?.thumbStyle)}>
                      {t?.picked && (
                        <>
                          <span style={{"position":"absolute","top":"8px","right":"8px","width":"20px","height":"20px","borderRadius":"var(--cta-r,7px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"0 2px 8px rgba(0,0,0,.35)","display":"flex","alignItems":"center","justifyContent":"center","zIndex":"2"}}>
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </span>
                        </>
                      )}
                      {t?.isGrid && (
                        <>
                          <div style={{"width":"100%","height":"100%","display":"grid","gridTemplateColumns":"1fr 1fr","gridTemplateRows":"1fr 1fr","gap":"4px"}}>
                            {arr(t?.rows3).map((r: any, i148: number) => (
                              <Fragment key={i148}>
                                <div style={css(cat("background:", t?.iconColor, ";opacity:.16;border-radius:9px"))} />
                              </Fragment>
                            ))}
                          </div>
                        </>
                      )}
                      {t?.isCard && (
                        <>
                          <div style={{"display":"flex","alignItems":"center","gap":"8px","width":"100%"}}>
                            <span style={css(cat("width:26px;height:26px;flex:none;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.35"))} />
                            <div style={{"flex":"1","display":"flex","flexDirection":"column","gap":"5px"}}>
                              <span style={css(cat("height:5px;width:70%;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.3"))} />
                              <span style={css(cat("height:5px;width:45%;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.18"))} />
                            </div>
                          </div>
                        </>
                      )}
                      {t?.isRows && (
                        <>
                          <div style={{"display":"flex","flexDirection":"column","gap":"6px","width":"100%"}}>
                            {arr(t?.rows3).map((r: any, i149: number) => (
                              <Fragment key={i149}>
                                <span style={css(cat("height:6px;width:100%;border-radius:9px;background:", t?.iconColor, ";opacity:.2"))} />
                              </Fragment>
                            ))}
                          </div>
                        </>
                      )}
                      {t?.isTimeline && (
                        <>
                          <div style={{"display":"flex","alignItems":"center","gap":"8px","width":"100%","padding":"0 4px"}}>
                            <div style={css(cat("flex:1;height:2px;background:", t?.iconColor, ";opacity:.28;position:relative"))}>
                              <span style={css(cat("position:absolute;left:8%;top:50%;width:6px;height:6px;border-radius:2px;background:", t?.iconColor, ";transform:translate(-50%,-50%)"))} />
                              <span style={css(cat("position:absolute;left:48%;top:50%;width:6px;height:6px;border-radius:2px;background:", t?.iconColor, ";transform:translate(-50%,-50%)"))} />
                              <span style={css(cat("position:absolute;left:88%;top:50%;width:6px;height:6px;border-radius:2px;background:", t?.iconColor, ";transform:translate(-50%,-50%)"))} />
                            </div>
                          </div>
                        </>
                      )}
                      {t?.isKanban && (
                        <>
                          <div style={{"display":"flex","gap":"5px","width":"100%","height":"100%"}}>
                            <div style={{"flex":"1","display":"flex","flexDirection":"column","gap":"4px"}}>
                              <span style={css(cat("height:14px;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.28"))} />
                              <span style={css(cat("height:9px;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.16"))} />
                            </div>
                            <div style={{"flex":"1","display":"flex","flexDirection":"column","gap":"4px"}}>
                              <span style={css(cat("height:9px;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.16"))} />
                            </div>
                            <div style={{"flex":"1","display":"flex","flexDirection":"column","gap":"4px"}}>
                              <span style={css(cat("height:14px;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.22"))} />
                            </div>
                          </div>
                        </>
                      )}
                      {t?.isChecklist && (
                        <>
                          <div style={{"display":"flex","flexDirection":"column","gap":"7px","width":"100%"}}>
                            {arr(t?.rows3).map((r: any, i150: number) => (
                              <Fragment key={i150}>
                                <div style={{"display":"flex","alignItems":"center","gap":"6px"}}>
                                  <span style={css(cat("width:9px;height:9px;flex:none;border-radius:2px;border:1.4px solid ", t?.iconColor, ";opacity:.6"))} />
                                  <span style={css(cat("height:5px;flex:1;border-radius:3px;background:", t?.iconColor, ";opacity:.18"))} />
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        </>
                      )}
                      {t?.isLedger && (
                        <>
                          <div style={{"display":"flex","flexDirection":"column","gap":"6px","width":"100%"}}>
                            {arr(t?.rows3).map((r: any, i151: number) => (
                              <Fragment key={i151}>
                                <div style={{"display":"flex","alignItems":"center","gap":"6px"}}>
                                  <span style={css(cat("height:5px;flex:1;border-radius:3px;background:", t?.iconColor, ";opacity:.18"))} />
                                  <span style={css(cat("height:5px;width:22%;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.4"))} />
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        </>
                      )}
                      {t?.isInvoice && (
                        <>
                          <div style={{"display":"flex","flexDirection":"column","gap":"6px","width":"100%"}}>
                            <span style={css(cat("height:5px;width:60%;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.3"))} />
                            <span style={css(cat("height:4px;width:100%;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.15"))} />
                            <span style={css(cat("height:4px;width:100%;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.15"))} />
                            <span style={css(cat("height:6px;width:35%;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.4;align-self:flex-end"))} />
                          </div>
                        </>
                      )}
                      {t?.isDocument && (
                        <>
                          <div style={{"display":"flex","gap":"8px","width":"100%"}}>
                            <div style={{"flex":"1","display":"flex","flexDirection":"column","gap":"5px"}}>
                              <span style={css(cat("height:5px;width:80%;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.3"))} />
                              <span style={css(cat("height:4px;width:100%;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.16"))} />
                              <span style={css(cat("height:4px;width:90%;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.16"))} />
                            </div>
                            <span style={css(cat("width:16px;flex:none;border-radius:var(--r-sm,9px);background:", t?.iconColor, ";opacity:.14"))} />
                          </div>
                        </>
                      )}
                      {t?.isGallery && (
                        <>
                          <div style={{"width":"100%","height":"100%","display":"grid","gridTemplateColumns":"1fr 1fr","gridTemplateRows":"1fr 1fr","gap":"4px"}}>
                            {arr(t?.rows3).map((r: any, i152: number) => (
                              <Fragment key={i152}>
                                <div style={css(cat("background:", t?.iconColor, ";opacity:.22;border-radius:9px"))} />
                              </Fragment>
                            ))}
                          </div>
                        </>
                      )}
                      {t?.isMap && (
                        <>
                          <div style={{"position":"relative","width":"100%","height":"100%"}}>
                            <span style={css(cat("position:absolute;left:30%;top:35%;width:7px;height:7px;border-radius:2px;background:", t?.iconColor, ";opacity:.7"))} />
                            <span style={css(cat("position:absolute;left:30%;top:35%;width:20px;height:20px;border-radius:7px;border:1.4px solid ", t?.iconColor, ";opacity:.3;transform:translate(-6px,-6px)"))} />
                            <span style={css(cat("position:absolute;left:68%;top:60%;width:6px;height:6px;border-radius:2px;background:", t?.iconColor, ";opacity:.5"))} />
                          </div>
                        </>
                      )}
                      {t?.isSchedule && (
                        <>
                          <div style={{"width":"100%","height":"100%","display":"grid","gridTemplateColumns":"repeat(7,1fr)","gap":"3px","alignContent":"center"}}>
                            {arr(t?.rows3).map((r: any, i153: number) => (
                              <Fragment key={i153}>
                                <div style={css(cat("height:8px;border-radius:9px;background:", t?.iconColor, ";opacity:.16"))} />
                              </Fragment>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <div style={{"padding":"10px 3px 0","textAlign":"left"}}>
                      <div style={{"fontSize":"13px","fontWeight":"500","color":"var(--ink)"}}>
                        {txt(t?.label)}
                      </div>
                      <div style={{"fontSize":"11px","color":"var(--dim)","lineHeight":"1.45","marginTop":"4px"}}>
                        {txt(t?.note)}
                      </div>
                    </div>
                  </button>
                </Fragment>
              ))}
            </div>
          </div>
          <div style={{"position":"relative","display":"flex","alignItems":"center","gap":"10px","padding":"18px 26px","borderTop":"1px solid var(--border)","marginTop":"18px"}}>
            <span style={{"flex":"1","minWidth":"0","fontFamily":"var(--mono)","fontSize":"10px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
              {txt(v.newRec?.footer)}
            </span>
            <button className={cx("ixz", "ix1f")} onClick={v.newRec?.close} style={{"height":"36px","padding":"0 16px","background":"var(--chip)","border":"1px solid var(--chip-border)","borderRadius":"var(--r-ctl,9px)","fontSize":"13px","color":"var(--ink)","cursor":"pointer","transition":"border-color .16s var(--ease)"}}>
              {"Cancel"}
            </button>
            <button className={cx("ixp", "ix1h")} onClick={v.newRec?.save} style={{"height":"36px","padding":"0 18px","border":"0","borderRadius":"var(--cta-r,9px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"13px","fontWeight":"500","cursor":"pointer","transition":"background .16s var(--ease),transform .16s var(--ease)"}}>
              {"Add record"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
