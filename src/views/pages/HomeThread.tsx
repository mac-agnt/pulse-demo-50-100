import { Fragment } from "react";
import { arr, cat, css, txt } from "../../runtime/template";

type Props = { v: any };

export default function HomeThread({ v }: Props) {
  return (
    <>
      <div style={css(v.threadWidthStyle)}>
        <div style={{"display":"flex","alignItems":"flex-start","gap":"20px","paddingBottom":"22px"}}>
          <div style={{"flex":"1","minWidth":"0","paddingTop":"2px"}}>
            <div style={{"fontFamily":"var(--mono)","fontSize":"10.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
              {"CONVERSATION"}
            </div>
            <div style={{"fontSize":"19px","fontWeight":"500","letterSpacing":"-0.45px","marginTop":"5px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
              {txt(v.threadTitle)}
            </div>
          </div>
          <div style={{"flex":"none","display":"flex","flexDirection":"column","alignItems":"flex-end","gap":"10px","animation":"popIn .34s var(--ease) both"}}>
            <div style={{"display":"flex","flexWrap":"nowrap","alignItems":"center","gap":"8px","fontFamily":"var(--mono)"}}>
              {arr(v.flipUnits).map((u: any, i6: number) => (
                <Fragment key={i6}>
                  <div style={{"display":"flex","flexWrap":"nowrap","alignItems":"center","gap":"3px"}}>
                    {arr(u?.tiles).map((t: any, i7: number) => (
                      <Fragment key={i7}>
                        {t?.isColon && (
                          <>
                            <div style={{"display":"flex","flexDirection":"column","gap":"3px","padding":"0 1px"}}>
                              <span style={{"width":"3px","height":"3px","borderRadius":"2px","background":"var(--accent)","animation":"tickPulse 1s ease-in-out infinite"}} />
                              <span style={{"width":"3px","height":"3px","borderRadius":"2px","background":"var(--accent)","animation":"tickPulse 1s ease-in-out .1s infinite"}} />
                            </div>
                          </>
                        )}
                        {t?.isTile && (
                          <>
                            <span style={css(cat("position:relative;display:flex;align-items:center;justify-content:center;min-width:", t?.cornerW, ";height:24px;padding:0 4px;border-radius:8px;background:var(--flap);border:1px solid var(--border);box-shadow:0 4px 10px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.1);font-size:", t?.cornerSize, ";font-weight:500;letter-spacing:-0.2px;color:", t?.color, ";overflow:hidden;perspective:90px"))}>
                              <span style={{"position":"absolute","left":"0","right":"0","top":"50%","height":"1px","background":"var(--flap-hinge)","zIndex":"4"}} />
                              {"\n"}
                              {txt(t?.v)}
                              {"\n"}
                              <span style={css(cat("position:absolute;top:0;left:0;right:0;height:50%;overflow:hidden;background:var(--flap);transform-origin:bottom center;backface-visibility:hidden;z-index:3;display:", t?.flapShow, ";animation:", t?.topAnim))}>
                                <span style={{"position":"absolute","top":"0","left":"0","right":"0","height":"200%","display":"flex","alignItems":"center","justifyContent":"center"}}>
                                  {txt(t?.prev)}
                                </span>
                              </span>
                              <span style={css(cat("position:absolute;bottom:0;left:0;right:0;height:50%;overflow:hidden;background:var(--flap);transform-origin:top center;backface-visibility:hidden;z-index:3;display:", t?.flapShow, ";animation:", t?.botAnim))}>
                                <span style={{"position":"absolute","bottom":"0","left":"0","right":"0","height":"200%","display":"flex","alignItems":"center","justifyContent":"center"}}>
                                  {txt(t?.v)}
                                </span>
                              </span>
                            </span>
                          </>
                        )}
                      </Fragment>
                    ))}
                  </div>
                </Fragment>
              ))}
            </div>
            <div style={{"display":"flex","alignItems":"center","gap":"7px"}}>
              <button className="ixg" onClick={v.toggleChatRail} style={{"flex":"none","height":"30px","display":"flex","alignItems":"center","gap":"7px","padding":"0 12px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,11px)","fontSize":"12px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease),transform .18s var(--ease)"}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4.4 4.4h6v6h-6v-6Z M13.6 4.4h6v6h-6v-6Z M4.4 13.6h6v6h-6v-6Z M13.6 13.6h6v6h-6v-6Z" />
                </svg>
                {txt(v.chatRailLabel)}
              </button>
              <button className="ixg" onClick={v.newThread} style={{"flex":"none","height":"30px","padding":"0 13px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,11px)","fontSize":"12px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease),transform .18s var(--ease)"}}>
                {"New chat"}
              </button>
            </div>
          </div>
        </div>
        {arr(v.thread).map((m: any, i8: number) => (
          <Fragment key={i8}>
            <div style={{"marginBottom":"24px"}}>
              {m?.isUser && (
                <>
                  <div style={{"display":"flex","justifyContent":"flex-end"}}>
                    <div style={{"maxWidth":"76%","padding":"12px 18px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px) 20px 6px 20px","fontSize":"14.5px","lineHeight":"1.55","backdropFilter":"blur(24px)"}}>
                      {txt(m?.text)}
                    </div>
                  </div>
                </>
              )}
              {m?.isHelios && (
                <>
                  <div style={{"display":"flex","gap":"14px","animation":"riseIn .4s var(--ease) both"}}>
                    <span style={{"width":"28px","height":"28px","flex":"none","borderRadius":"var(--r-sm,10px)","background":"var(--accent-soft)","border":"1px solid var(--accent-line)","display":"flex","alignItems":"center","justifyContent":"center","marginTop":"2px"}}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12h4l2.5-6 3.5 12 3-8 2 2h5" />
                      </svg>
                    </span>
                    <div style={{"flex":"1","minWidth":"0"}}>
                      {m?.hasTool && (
                        <>
                          <div style={{"display":"inline-flex","alignItems":"center","gap":"8px","padding":"5px 11px","marginBottom":"12px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"7px","fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--dim)"}}>
                            <span style={css(cat("width:5px;height:5px;border-radius:2px;background:", m?.toolDot))} />
                            {txt(m?.tool)}
                            <span style={{"color":"var(--faint)"}}>
                              {txt(m?.toolEffect)}
                            </span>
                          </div>
                        </>
                      )}
                      <div style={{"fontSize":"14.5px","lineHeight":"1.75","color":"var(--body)","textWrap":"pretty"}}>
                        {txt(m?.text)}
                        {m?.typing && (
                          <>
                            <span style={{"animation":"blink 1s steps(1) infinite","color":"var(--accent)"}}>
                              {"▌"}
                            </span>
                          </>
                        )}
                      </div>
                      {m?.hasTable && (
                        <>
                          <div style={{"marginTop":"16px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(16px)","overflow":"hidden"}}>
                            <div style={css(cat("display:grid;grid-template-columns:", m?.tableCols, ";background:var(--surface)"))}>
                              {arr(m?.cols).map((c: any, i9: number) => (
                                <Fragment key={i9}>
                                  <div style={{"padding":"11px 16px","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.09em","color":"var(--faint)","textTransform":"uppercase"}}>
                                    {txt(c)}
                                  </div>
                                </Fragment>
                              ))}
                            </div>
                            {arr(m?.rows).map((r: any, i10: number) => (
                              <Fragment key={i10}>
                                <div className="ixh" style={css(cat("display:grid;grid-template-columns:", m?.tableCols, ";border-top:1px solid var(--border)"))}>
                                  {arr(r?.cells).map((cell: any, i11: number) => (
                                    <Fragment key={i11}>
                                      <div style={css(cat("padding:12px 16px;font-family:", cell?.font, ";font-size:13px;color:", cell?.color, ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap"))}>
                                        {txt(cell?.v)}
                                      </div>
                                    </Fragment>
                                  ))}
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        </>
                      )}
                      {m?.hasConfirm && (
                        <>
                          <div style={{"marginTop":"16px","padding":"16px 18px","background":"var(--accent-faint)","border":"1px solid var(--accent-line)","borderRadius":"var(--card-r,18px)"}}>
                            <div style={{"display":"flex","alignItems":"center","gap":"9px"}}>
                              <span style={{"fontFamily":"var(--mono)","fontSize":"10px","letterSpacing":"0.1em","color":"var(--accent)"}}>
                                {"NEEDS YOUR YES"}
                              </span>
                              <span style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)"}}>
                                {txt(m?.confirmHash)}
                              </span>
                            </div>
                            <div style={{"fontSize":"13.5px","lineHeight":"1.6","color":"var(--ink)","marginTop":"9px"}}>
                              {txt(m?.confirmSummary)}
                            </div>
                            <div style={{"display":"flex","flexWrap":"wrap","gap":"8px","marginTop":"14px"}}>
                              {arr(m?.actions).map((a: any, i12: number) => (
                                <Fragment key={i12}>
                                  <button onClick={a?.run} style={css(cat("height:34px;padding:0 16px;border:1px solid ", a?.border, ";background:", a?.bg, ";color:", a?.color, ";border-radius:var(--r-ctl,9px);font-size:13px;font-weight:500;cursor:pointer;transition:background .2s var(--ease),transform .18s var(--ease),box-shadow .24s var(--ease)"))}>
                                    {txt(a?.label)}
                                  </button>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                      {m?.hasActions && (
                        <>
                          <div style={{"display":"flex","flexWrap":"wrap","gap":"8px","marginTop":"16px"}}>
                            {arr(m?.actions).map((a: any, i13: number) => (
                              <Fragment key={i13}>
                                <button onClick={a?.run} style={css(cat("height:34px;padding:0 16px;border:1px solid ", a?.border, ";background:", a?.bg, ";color:", a?.color, ";border-radius:var(--r-ctl,9px);font-size:13px;font-weight:500;cursor:pointer;transition:background .2s var(--ease),transform .18s var(--ease),box-shadow .24s var(--ease)"))}>
                                  {txt(a?.label)}
                                </button>
                              </Fragment>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Fragment>
        ))}
      </div>
    </>
  );
}
