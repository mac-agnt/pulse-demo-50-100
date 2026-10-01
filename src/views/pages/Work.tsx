import { Fragment } from "react";
import { arr, cat, css, cx, txt } from "../../runtime/template";
import WorkSchedules from "./WorkSchedules";

type Props = { v: any };

export default function Work({ v }: Props) {
  return (
    <>
      <div style={{"width":"100%","maxWidth":"1280px","margin":"0 auto","boxSizing":"border-box","padding":"22px 32px 40px","animation":"pageIn .7s var(--ease) both"}}>
        <div style={{"display":"flex","alignItems":"stretch","gap":"20px","flexWrap":"wrap","padding":"20px 4px 22px"}}>
          <div style={{"flex":"1","minWidth":"280px","display":"flex","flexDirection":"column","justifyContent":"flex-start"}}>
            <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.16em","color":"var(--faint)"}}>
              {"WORKSPACE"}
            </div>
            <div style={{"display":"flex","alignItems":"center","gap":"12px","marginTop":"8px"}}>
              <h1 style={{"margin":"0","fontSize":"44px","fontWeight":"500","letterSpacing":"-1.8px","lineHeight":"1"}}>
                {txt(v.work?.title)}
              </h1>
              <span style={{"width":"22px","height":"22px","borderRadius":"8px","border":"1px solid var(--border)","color":"var(--faint)","display":"flex","alignItems":"center","justifyContent":"center","fontSize":"11px"}} title={v.work?.blurb}>
                {"i"}
              </span>
            </div>
            {v.work?.showBlurb && (
              <>
                <div style={{"fontSize":"14px","color":"var(--dim)","marginTop":"10px"}}>
                  {txt(v.work?.blurb)}
                </div>
              </>
            )}
            {v.work?.hasStats && (
              <>
                <div style={{"display":"flex","alignItems":"center","gap":"14px","flex":"1","marginTop":"22px"}}>
                  <button className={cx("ixn", "ixo")} onClick={v.work?.add} style={{"flex":"none","width":"52px","height":"52px","border":"0","borderRadius":"var(--card-r,18px)","background":"var(--ink)","color":"var(--bg)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"transform .2s var(--ease)"}}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 5v14 M5 12h14" />
                    </svg>
                  </button>
                  <div style={{"flex":"1","minWidth":"0","display":"flex","flexWrap":"wrap","gap":"18px 34px","alignItems":"center","overflow":"visible"}}>
                    {arr(v.work?.stats).map((s: any, i23: number) => (
                      <Fragment key={i23}>
                        <div style={{"display":"flex","flexDirection":"column","justifyContent":"center","minWidth":"max-content"}}>
                          <div style={{"display":"flex","alignItems":"center","gap":"7px","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.13em","color":"var(--faint)","whiteSpace":"nowrap"}}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
                              <path d={s?.icon} />
                            </svg>
                            {txt(s?.label)}
                          </div>
                          <div style={css(cat("font-family:var(--mono);font-size:34px;font-weight:var(--fig-weight,inherit);font-weight:500;letter-spacing:-1px;line-height:1.1;margin-top:4px;color:", s?.color))}>
                            {txt(s?.value)}
                          </div>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          {v.work?.showOpsHeader && (
            <>
              <div style={{"flex":"none","display":"flex","flexDirection":"column","alignItems":"flex-end","gap":"14px"}}>
                <div style={{"display":"flex","flexWrap":"wrap","gap":"8px"}}>
                  <button className={cx("ixp", "ixq")} onClick={v.ops?.create} style={{"height":"36px","display":"flex","alignItems":"center","gap":"8px","padding":"0 15px","border":"0","borderRadius":"var(--cta-r,9px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"13px","fontWeight":"500","cursor":"pointer","transition":"background .2s var(--ease),transform .18s var(--ease)"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                      <path d="M12 5v14 M5 12h14" />
                    </svg>
                    {"Create workflow"}
                  </button>
                  <button className="ixg" onClick={v.ops?.schedule} style={{"height":"36px","display":"flex","alignItems":"center","gap":"8px","padding":"0 15px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","fontSize":"13px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),transform .18s var(--ease)"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 4v3 M16 4v3 M4.5 9.5h15 M6.4 6h11.2A1.9 1.9 0 0 1 19.5 8v10a1.9 1.9 0 0 1-1.9 1.9H6.4A1.9 1.9 0 0 1 4.5 18V8A1.9 1.9 0 0 1 6.4 6Z" />
                    </svg>
                    {"Schedule task"}
                  </button>
                  <button className="ixg" onClick={v.ops?.teach} style={{"height":"36px","display":"flex","alignItems":"center","gap":"8px","padding":"0 15px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","fontSize":"13px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),transform .18s var(--ease)"}}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8.5 3.6h7A2.4 2.4 0 0 1 17.9 6v5.6a2.4 2.4 0 0 1-2.4 2.4h-7A2.4 2.4 0 0 1 6.1 11.6V6a2.4 2.4 0 0 1 2.4-2.4Z M12 14v2.6 M7.6 20.4h8.8" />
                    </svg>
                    {"Teach agent"}
                  </button>
                </div>
                {v.work?.isWorkflows && (
                  <>
                    <div style={{"display":"flex","flexWrap":"wrap","gap":"8px"}}>
                      {arr(v.ops?.summary).map((s: any, i24: number) => (
                        <Fragment key={i24}>
                          {s?.active && (
                            <>
                              <button onClick={s?.pick} style={{"minWidth":"118px","padding":"12px 15px","borderRadius":"var(--card-r,18px)","cursor":"pointer","textAlign":"left","background":"var(--accent)","border":"1px solid var(--accent)"}}>
                                <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.12em","color":"var(--on-accent-2)"}}>
                                  {txt(s?.label)}
                                </div>
                                <div style={{"fontFamily":"var(--mono)","fontSize":"22px","fontWeight":"var(--fig-weight,inherit)","letterSpacing":"-.6px","marginTop":"6px","color":"var(--on-accent)"}}>
                                  {txt(s?.value)}
                                </div>
                              </button>
                            </>
                          )}
                          {s?.inactive && (
                            <>
                              <button className="ixr" onClick={s?.pick} style={{"minWidth":"118px","padding":"12px 15px","borderRadius":"var(--card-r,18px)","cursor":"pointer","textAlign":"left","background":"var(--surface)","border":"1px solid var(--border)","transition":"border-color .2s var(--ease),transform .18s var(--ease)"}}>
                                <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                                  {txt(s?.label)}
                                </div>
                                <div style={css(cat("font-family:var(--mono);font-size:22px;font-weight:var(--fig-weight,inherit);letter-spacing:-.6px;margin-top:6px;color:", s?.valueColor))}>
                                  {txt(s?.value)}
                                </div>
                              </button>
                            </>
                          )}
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
          {v.work?.isTasks && (
            <>
              <div style={{"flex":"none","width":"min(430px,100%)","padding":"20px 22px 22px","background":"var(--surface-strong)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)"}}>
                <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
                  <span style={{"flex":"1","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.16em","color":"var(--faint)"}}>
                    {txt(v.timer?.eyebrow)}
                  </span>
                  <span style={css(cat("font-family:var(--mono);font-size:9.5px;letter-spacing:0.14em;color:", v.timer?.stateColor))}>
                    {txt(v.timer?.state)}
                  </span>
                </div>
                <div style={{"display":"flex","alignItems":"center","gap":"20px","marginTop":"16px"}}>
                  <div style={{"flex":"none","width":"96px","height":"96px","borderRadius":"50%","display":"flex","alignItems":"center","justifyContent":"center","position":"relative"}}>
                    <span style={css(cat("position:absolute;inset:0;border-radius:50%;border:2px solid ", v.timer?.ringColor, ";opacity:.6"))} />
                    <span style={css(v.timer?.innerRingStyle)} />
                    <span style={{"fontFamily":"var(--mono)","fontSize":"20px","fontWeight":"var(--fig-weight,inherit)","letterSpacing":"-0.5px","color":"var(--ink)"}}>
                      {txt(v.timer?.display)}
                    </span>
                  </div>
                  <div style={{"flex":"1","minWidth":"0"}}>
                    <div style={{"fontSize":"16px","fontWeight":"500","letterSpacing":"-.3px"}}>
                      {txt(v.timer?.title)}
                    </div>
                    <div style={{"fontSize":"12.5px","color":"var(--dim)","marginTop":"5px","lineHeight":"1.5"}}>
                      {txt(v.timer?.subtitle)}
                    </div>
                    <div style={{"display":"flex","gap":"7px","marginTop":"12px"}}>
                      {arr(v.timer?.presets).map((p: any, i25: number) => (
                        <Fragment key={i25}>
                          <button onClick={p?.pick} style={css(p?.style)}>
                            {txt(p?.label)}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{"height":"1px","background":"var(--border)","margin":"18px 0"}} />
                <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
                  <button className={cx("ixb", "ixs")} onClick={v.timer?.toggle} style={css(cat("flex:1;height:44px;display:flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:var(--r-md,14px);background:", v.timer?.buttonBg, ";color:", v.timer?.buttonInk, ";font-size:14px;font-weight:500;cursor:pointer;transition:background .2s var(--ease),transform .18s var(--ease)"))}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d={v.timer?.buttonIcon} />
                    </svg>
                    {txt(v.timer?.buttonLabel)}
                  </button>
                  <button className="ixm" onClick={v.timer?.reset} title="Reset" style={{"flex":"none","width":"44px","height":"44px","border":"1px solid var(--border)","borderRadius":"var(--r-md,14px)","background":"none","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3.5 5.5v5h5 M4.2 14a8 8 0 1 0 .3-5.3" />
                    </svg>
                  </button>
                  <button className="ixt" onClick={v.timer?.complete} title="Mark done" style={{"flex":"none","width":"44px","height":"44px","border":"1px solid var(--border)","borderRadius":"var(--r-md,14px)","background":"none","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        {v.work?.hasViews && (
          <>
            <div style={{"display":"flex","flexWrap":"wrap","alignItems":"center","gap":"10px","padding":"0 4px 16px"}}>
              <div style={css(v.work?.viewTrack)}>
                <span style={css(v.work?.viewThumb)} />
                {arr(v.work?.views).map((v: any, i26: number) => (
                  <Fragment key={i26}>
                    {v?.active && (
                      <>
                        <button onClick={v?.pick} style={{"position":"relative","zIndex":"1","display":"flex","alignItems":"center","justifyContent":"center","height":"32px","padding":"0 16px","border":"0","borderRadius":"var(--r-ctl,11px)","background":"none","color":"var(--pill-ink)","fontSize":"12.5px","fontWeight":"600","cursor":"pointer","whiteSpace":"nowrap","transition":"color .3s var(--ease)"}}>
                          {txt(v?.label)}
                        </button>
                      </>
                    )}
                    {v?.inactive && (
                      <>
                        <button className="ix3" onClick={v?.pick} style={{"position":"relative","zIndex":"1","display":"flex","alignItems":"center","justifyContent":"center","height":"32px","padding":"0 16px","border":"0","borderRadius":"var(--r-ctl,11px)","background":"none","color":"var(--dim)","fontSize":"12.5px","cursor":"pointer","whiteSpace":"nowrap","transition":"color .3s var(--ease)"}}>
                          {txt(v?.label)}
                        </button>
                      </>
                    )}
                  </Fragment>
                ))}
              </div>
              <div style={{"width":"1px","height":"24px","background":"var(--border)"}} />
              {arr(v.work?.filters).map((c: any, i27: number) => (
                <Fragment key={i27}>
                  <button className="ixg" style={{"height":"32px","display":"flex","alignItems":"center","gap":"7px","padding":"0 14px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","fontSize":"12.5px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),transform .18s var(--ease)"}}>
                    {txt(c)}
                  </button>
                </Fragment>
              ))}
              <button className="ixu" onClick={v.toggleFilterMenu} style={{"height":"32px","display":"flex","alignItems":"center","gap":"7px","padding":"0 13px","background":"none","border":"1px dashed var(--border-strong)","borderRadius":"var(--r-ctl,9px)","fontSize":"12.5px","color":"var(--dim)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14 M5 12h14" />
                </svg>
                {"Filter"}
              </button>
            </div>
          </>
        )}
        {v.work?.isTasks && (
          <>
            <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"6px 22px 10px"}}>
              <div style={{"display":"flex","alignItems":"center","gap":"12px","padding":"16px 0 14px"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.9" strokeLinecap="round" style={{"flex":"none"}}>
                  <path d="M12 5v14 M5 12h14" />
                </svg>
                <input value={v.newTask ?? ""} onChange={v.setNewTask} onKeyDown={v.onNewTaskKey} placeholder="Add a task…" style={{"flex":"1","minWidth":"0","border":"0","outline":"0","background":"none","fontSize":"15px"}} />
                <span style={{"fontSize":"12px","color":"var(--faint)","whiteSpace":"nowrap"}}>
                  {"Priority"}
                </span>
                <button onClick={v.cyclePriority} style={css(cat("height:30px;display:flex;align-items:center;gap:7px;padding:0 12px;background:", v.newPriorityBg, ";border:1px solid ", v.newPriorityBorder, ";border-radius:var(--r-ctl,9px);font-size:12px;color:", v.newPriorityColor, ";cursor:pointer;transition:background .2s var(--ease),border-color .2s var(--ease)"))}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 20V4.6h9l-1 3.4h6.4L18 12h1.4l-9.6 5.4V20" />
                  </svg>
                  {txt(v.newPriority)}
                </button>
                <button className={cx("ixp", "ixq")} onClick={v.addTask} style={{"height":"30px","display":"flex","alignItems":"center","gap":"7px","padding":"0 15px","border":"0","borderRadius":"var(--cta-r,9px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"12.5px","fontWeight":"500","cursor":"pointer","transition":"background .2s var(--ease),transform .18s var(--ease)"}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 5v14 M5 12h14" />
                  </svg>
                  {"Add"}
                </button>
              </div>
              {arr(v.workTasks).map((t: any, i28: number) => (
                <Fragment key={i28}>
                  <div style={{"display":"flex","alignItems":"flex-start","gap":"14px","padding":"16px 0","borderTop":"1px solid var(--border)","transition":"background .2s var(--ease)"}}>
                    <button className="ixv" onClick={t?.toggle} style={css(cat("width:21px;height:21px;flex:none;margin-top:1px;border-radius:7px;border:1.5px solid ", t?.ring, ";background:", t?.fill, ";color:var(--on-accent);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .22s var(--ease),border-color .22s var(--ease),transform .18s var(--ease)"))}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" style={css(cat("opacity:", t?.checkOpacity, ";transition:opacity .18s var(--ease)"))}>
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </button>
                    <div style={{"flex":"1","minWidth":"0"}}>
                      <div style={css(cat("font-size:15px;line-height:1.35;color:", t?.color, ";text-decoration:", t?.strike))}>
                        {txt(t?.title)}
                      </div>
                      <div style={{"display":"flex","flexWrap":"wrap","alignItems":"center","gap":"18px","marginTop":"8px"}}>
                        {arr(t?.meta).map((m: any, i29: number) => (
                          <Fragment key={i29}>
                            <div style={css(cat("display:flex;align-items:center;gap:6px;font-size:12px;color:", m?.color))}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
                                <path d={m?.icon} />
                              </svg>
                              {txt(m?.label)}
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                    <span style={css(t?.statusStyle)}>
                      <span style={css(t?.statusDot)} />
                      {txt(t?.status)}
                    </span>
                    <span style={css(t?.prioStyle)}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
                        <path d="M5 20V4.6h9l-1 3.4h6.4L18 12h1.4l-9.6 5.4V20" />
                      </svg>
                      {txt(t?.priority)}
                    </span>
                    <span style={{"flex":"none","width":"26px","height":"26px","borderRadius":"var(--r-sm,9px)","background":"var(--track)","color":"var(--body)","display":"flex","alignItems":"center","justifyContent":"center","fontSize":"9.5px","fontWeight":"500"}}>
                      {txt(t?.who)}
                    </span>
                    <button className="ixw" onClick={t?.start} style={{"flex":"none","height":"30px","display":"flex","alignItems":"center","gap":"7px","padding":"0 13px","background":"none","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,11px)","fontSize":"12px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 4.5v15l13-7.5-13-7.5Z" />
                      </svg>
                      {"Start"}
                    </button>
                  </div>
                </Fragment>
              ))}
              {v.workTasksEmpty && (
                <>
                  <div style={{"padding":"48px 0","textAlign":"center","borderTop":"1px solid var(--border)"}}>
                    <div style={{"fontSize":"14px"}}>
                      {"Nothing in this view"}
                    </div>
                    <div style={{"fontSize":"12.5px","color":"var(--dim)","marginTop":"5px"}}>
                      {"Add a task above, or switch view."}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
        {v.work?.isApprovals && (
          <>
            <div style={{"display":"flex","flexDirection":"column","gap":"10px"}}>
              {arr(v.workApprovals).map((a: any, i30: number) => (
                <Fragment key={i30}>
                  <div className="ixx" style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"15px 18px","transition":"transform .26s var(--ease),border-color .22s var(--ease)"}}>
                    <div style={{"display":"flex","alignItems":"flex-start","gap":"12px","flexWrap":"wrap"}}>
                      <div style={{"flex":"1","minWidth":"220px"}}>
                        <div style={{"display":"flex","alignItems":"center","gap":"9px","flexWrap":"wrap"}}>
                          <span style={{"fontSize":"14px","fontWeight":"500"}}>
                            {txt(a?.title)}
                          </span>
                          <span style={css(a?.statusStyle)}>
                            {txt(a?.status)}
                          </span>
                        </div>
                        <div style={{"fontSize":"12px","color":"var(--dim)","marginTop":"4px"}}>
                          {txt(a?.subject)}
                        </div>
                      </div>
                      <span style={{"fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--faint)"}}>
                        {txt(a?.age)}
                      </span>
                    </div>
                    <div style={{"display":"flex","flexWrap":"wrap","alignItems":"center","gap":"8px","marginTop":"12px"}}>
                      {arr(a?.steps).map((s: any, i31: number) => (
                        <Fragment key={i31}>
                          <div style={{"display":"flex","alignItems":"center","gap":"7px","padding":"5px 10px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"7px"}}>
                            <span style={css(cat("width:5px;height:5px;border-radius:2px;background:", s?.dot))} />
                            <span style={{"fontSize":"11.5px","color":"var(--ink)"}}>
                              {txt(s?.who)}
                            </span>
                            <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
                              {txt(s?.state)}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                      <div style={{"flex":"1","minWidth":"6px"}} />
                      <button className="ixy" onClick={a?.openWork} style={{"display":"inline-flex","alignItems":"center","gap":"7px","height":"30px","padding":"0 13px","border":"1px solid var(--accent-line)","borderRadius":"var(--r-ctl,11px)","background":"var(--accent-faint)","fontSize":"12.5px","color":"var(--ink)","cursor":"pointer","transition":"background .2s var(--ease),transform .18s var(--ease)"}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2.6 12S6.4 5.5 12 5.5 21.4 12 21.4 12 17.6 18.5 12 18.5 2.6 12 2.6 12Z" />
                          <circle cx="12" cy="12" r="2.6" />
                        </svg>
                        {txt(a?.viewLabel)}
                      </button>
                      {a?.pending && (
                        <>
                          <button className="ixp" onClick={a?.approve} style={{"height":"30px","padding":"0 14px","border":"0","borderRadius":"var(--cta-r,9px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"12.5px","fontWeight":"500","cursor":"pointer","transition":"background .2s var(--ease),transform .18s var(--ease)"}}>
                            {"Approve"}
                          </button>
                          <button className="ixz" onClick={a?.approve} style={{"height":"30px","padding":"0 13px","border":"1px solid var(--border)","background":"none","borderRadius":"var(--r-ctl,9px)","fontSize":"12.5px","color":"var(--ink)","cursor":"pointer","transition":"border-color .2s var(--ease)"}}>
                            {"Decline"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </Fragment>
              ))}
              {v.workApprovalsEmpty && (
                <>
                  <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"40px 22px","textAlign":"center"}}>
                    <div style={{"fontSize":"14px"}}>
                      {"Nothing waiting on you"}
                    </div>
                    <div style={{"fontSize":"12.5px","color":"var(--dim)","marginTop":"5px"}}>
                      {"Requests appear here with every step and who it sits with."}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
        {v.work?.isWorkflows && (
          <>
            <div style={{"display":"flex","flexWrap":"wrap","alignItems":"center","gap":"10px","padding":"0 4px 16px"}}>
              {arr(v.ops?.filters).map((c: any, i32: number) => (
                <Fragment key={i32}>
                  {c?.active && (
                    <>
                      <button onClick={c?.pick} style={{"display":"flex","alignItems":"center","gap":"8px","height":"32px","padding":"0 14px","borderRadius":"var(--r-ctl,11px)","cursor":"pointer","fontSize":"12.5px","whiteSpace":"nowrap","background":"var(--pill-bg)","border":"1px solid var(--pill-bg)","color":"var(--pill-ink)","fontWeight":"500","boxShadow":"0 2px 5px rgba(0,0,0,.34),0 6px 16px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.5)"}}>
                        {txt(c?.label)}
                        <span style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--pill-ink)","opacity":".75"}}>
                          {txt(c?.count)}
                        </span>
                      </button>
                    </>
                  )}
                  {c?.inactive && (
                    <>
                      <button className="ix10" onClick={c?.pick} style={{"display":"flex","alignItems":"center","gap":"8px","height":"32px","padding":"0 14px","borderRadius":"var(--r-ctl,11px)","cursor":"pointer","fontSize":"12.5px","whiteSpace":"nowrap","background":"var(--surface)","border":"1px solid var(--border)","color":"var(--dim)","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
                        {txt(c?.label)}
                        <span style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)"}}>
                          {txt(c?.count)}
                        </span>
                      </button>
                    </>
                  )}
                </Fragment>
              ))}
            </div>
            <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"6px 0 10px","overflow":"hidden"}}>
              <div style={{"display":"grid","gridTemplateColumns":"1.5fr 1fr .9fr .8fr .7fr 52px","padding":"12px 20px 10px"}}>
                {arr(v.ops?.columns).map((c: any, i33: number) => (
                  <Fragment key={i33}>
                    <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.1em","color":"var(--faint)","textTransform":"uppercase"}}>
                      {txt(c)}
                    </div>
                  </Fragment>
                ))}
              </div>
              {arr(v.ops?.rows).map((w: any, i34: number) => (
                <Fragment key={i34}>
                  <div className="ix11" onClick={w?.open} style={css(cat("display:grid;grid-template-columns:1.5fr 1fr .9fr .8fr .7fr 52px;gap:10px;padding:15px 20px;border-top:1px solid var(--border);cursor:pointer;background:", w?.rowBg, ";transition:background .2s var(--ease)"))}>
                    <div style={{"minWidth":"0","display":"flex","alignItems":"center","gap":"11px"}}>
                      <span style={css(cat("width:8px;height:8px;flex:none;border-radius:2px;background:", w?.statusColor))} />
                      <div style={{"minWidth":"0"}}>
                        <div style={{"fontSize":"13.5px","lineHeight":"1.35","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                          {txt(w?.name)}
                        </div>
                        <div style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)","marginTop":"4px"}}>
                          {txt(w?.kindLabel)}
                        </div>
                      </div>
                    </div>
                    <div style={{"minWidth":"0","display":"flex","flexDirection":"column","justifyContent":"center"}}>
                      <div style={{"fontSize":"12.5px","color":"var(--body)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(w?.trigger)}
                      </div>
                      <div style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)","marginTop":"4px"}}>
                        {txt(w?.triggerKind)}
                      </div>
                    </div>
                    <div style={{"minWidth":"0","display":"flex","alignItems":"center","gap":"8px"}}>
                      <span style={css(w?.ownerChip)}>
                        {txt(w?.ownerInitials)}
                      </span>
                      <span style={{"minWidth":"0","fontSize":"12.5px","color":"var(--body)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(w?.owner)}
                      </span>
                    </div>
                    <div style={{"minWidth":"0","display":"flex","flexDirection":"column","justifyContent":"center"}}>
                      <div style={{"fontFamily":"var(--mono)","fontSize":"12px","color":"var(--ink)"}}>
                        {txt(w?.nextRun)}
                      </div>
                      <div style={{"fontSize":"10.5px","color":"var(--faint)","marginTop":"4px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(w?.lastResult)}
                      </div>
                    </div>
                    <div style={{"minWidth":"0","display":"flex","flexDirection":"column","justifyContent":"center","gap":"6px"}}>
                      <span style={css(w?.statusStyle)}>
                        {txt(w?.status)}
                      </span>
                      <div style={{"display":"flex","alignItems":"center","gap":"7px"}}>
                        <div style={{"flex":"1","minWidth":"0","height":"4px","borderRadius":"2px","background":"var(--track)","overflow":"hidden"}}>
                          <div style={css(cat("height:4px;border-radius:var(--r-sm,9px);width:", w?.rate, ";background:", w?.statusColor))} />
                        </div>
                        <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
                          {txt(w?.rate)}
                        </span>
                      </div>
                    </div>
                    <div style={{"display":"flex","alignItems":"center","justifyContent":"flex-end"}}>
                      <button onClick={w?.toggle} style={css(cat("width:38px;height:22px;flex:none;border:0;border-radius:8px;background:", w?.trackBg, ";cursor:pointer;padding:0;position:relative;transition:background .22s var(--ease)"))}>
                        <span style={css(cat("position:absolute;top:3px;left:", w?.knobLeft, ";width:16px;height:16px;border-radius:6px;background:", w?.knobBg, ";transition:left .24s var(--ease)"))} />
                      </button>
                    </div>
                  </div>
                </Fragment>
              ))}
              {v.ops?.empty && (
                <>
                  <div style={{"padding":"48px 20px","textAlign":"center"}}>
                    <div style={{"fontSize":"14px"}}>
                      {"Nothing matches that filter"}
                    </div>
                    <div style={{"fontSize":"12.5px","color":"var(--dim)","marginTop":"5px"}}>
                      {"Clear it to see everything Pulse runs on its own."}
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
        {v.work?.isSchedules && <WorkSchedules v={v} />}
      </div>
    </>
  );
}
