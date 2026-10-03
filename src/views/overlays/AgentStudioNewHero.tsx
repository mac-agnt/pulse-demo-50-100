import { Fragment } from "react";
import { arr, css, txt } from "../../runtime/template";
import AgentFace from "../../components/AgentFace";

type Props = { v: any };

export default function AgentStudioNewHero({ v }: Props) {
  return (
    <>
      <div style={{"display":"flex","alignItems":"center","gap":"10px","marginTop":"24px"}}>
        <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
          {"TASKS · TELL IT THE JOB"}
        </span>
        <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
        <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
          {txt(v.taskCount)}
        </span>
      </div>
      <div style={{"marginTop":"12px","padding":"14px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)"}}>
        {v.briefEmpty && (
          <>
            <div style={{"display":"flex","alignItems":"flex-start","gap":"11px","padding":"2px 2px 12px"}}>
              <AgentFace shape={v.draftAgent?.shape} state={v.draftAgent?.state} tint={v.draftAgent?.tint} size={"32"} />
              <div style={{"flex":"1","minWidth":"0"}}>
                <div style={{"fontSize":"13px","color":"var(--ink)","lineHeight":"1.5"}}>
                  {"Good to meet you. What is the main thing you want help with?"}
                </div>
                <div style={{"fontSize":"11.5px","color":"var(--faint)","marginTop":"4px"}}>
                  {"Say it plainly. It will ask the follow-ups it needs."}
                </div>
              </div>
            </div>
          </>
        )}
        <div style={{"display":"flex","flexDirection":"column","gap":"9px"}}>
          {arr(v.briefThread).map((m: any, i136: number) => (
            <Fragment key={i136}>
              <div style={css(m?.rowStyle)}>
                {m?.isMsg && (
                  <>
                    <div style={css(m?.bubbleStyle)}>
                      {txt(m?.text)}
                    </div>
                  </>
                )}
                {m?.isCard && (
                  <>
                    <div style={css(m?.cardStyle)}>
                      <div style={{"padding":"12px 13px 10px"}}>
                        <div style={{"fontSize":"13.5px","fontWeight":"500","color":"var(--ink)"}}>
                          {txt(m?.title)}
                        </div>
                        {m?.live && (
                          <>
                            <div style={{"fontSize":"11.5px","color":"var(--dim)","marginTop":"3px"}}>
                              {txt(m?.sub)}
                            </div>
                          </>
                        )}
                        {m?.answered && (
                          <>
                            <div style={{"display":"flex","alignItems":"center","gap":"7px","marginTop":"5px"}}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
                                <path d="m5 12.5 4.5 4.5L19 7.5" />
                              </svg>
                              <span style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                                {txt(m?.answerSummary)}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      {m?.live && (
                        <>
                          <div style={{"borderTop":"1px solid var(--border)"}}>
                            {arr(m?.options).map((o: any, i137: number) => (
                              <Fragment key={i137}>
                                <button className="ix11" onClick={o?.pick} style={css(o?.style)}>
                                  <span style={css(o?.keyStyle)}>
                                    {txt(o?.key)}
                                  </span>
                                  <span style={{"flex":"1","minWidth":"0","display":"block"}}>
                                    <span style={css(o?.labelStyle)}>
                                      {txt(o?.label)}
                                    </span>
                                    <span style={{"display":"block","fontSize":"11px","color":"var(--faint)","marginTop":"2px"}}>
                                      {txt(o?.meta)}
                                    </span>
                                  </span>
                                </button>
                              </Fragment>
                            ))}
                          </div>
                          <div style={{"display":"flex","alignItems":"center","gap":"9px","padding":"10px 12px","borderTop":"1px solid var(--border)"}}>
                            <span style={{"flex":"1","fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.1em","color":"var(--faint)"}}>
                              {"TAP TO SELECT"}
                            </span>
                            <button className="ixb" onClick={m?.confirm} style={{"height":"28px","padding":"0 13px","border":"0","borderRadius":"var(--cta-r,9px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"12px","fontWeight":"500","cursor":"pointer","transition":"transform .18s var(--ease)"}}>
                              {txt(m?.confirmLabel)}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Fragment>
          ))}
        </div>
        <div className="ix13" style={{"display":"flex","alignItems":"center","gap":"8px","marginTop":"12px","padding":"5px 5px 5px 13px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"7px","transition":"border-color .22s var(--ease)"}}>
          <input value={v.briefDraft ?? ""} onChange={v.setBriefDraft} onKeyDown={v.onBriefKey} placeholder={v.briefPlaceholder} style={{"flex":"1","minWidth":"0","border":"0","outline":"0","background":"none","fontSize":"13px","color":"var(--ink)"}} />
          <button className="ixb" onClick={v.sendBrief} title="Send" style={{"flex":"none","width":"30px","height":"30px","border":"0","borderRadius":"var(--cta-r,11px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"transform .18s var(--ease)"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5 M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
        {v.hasTasks && (
          <>
            <div style={{"display":"flex","flexDirection":"column","gap":"7px","marginTop":"12px"}}>
              {arr(v.briefTasks).map((t: any, i138: number) => (
                <Fragment key={i138}>
                  <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"10px 12px","background":"var(--accent-faint)","border":"1px solid var(--accent-line)","borderRadius":"var(--r-sm,11px)","animation":"expandIn .3s var(--ease) both"}}>
                    <span style={{"flex":"none","width":"22px","height":"22px","borderRadius":"8px","background":"var(--accent-soft)","color":"var(--accent)","display":"flex","alignItems":"center","justifyContent":"center"}}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                    <span style={{"flex":"1","minWidth":"0","display":"block"}}>
                      <span style={{"display":"block","fontSize":"12.5px","color":"var(--ink)"}}>
                        {txt(t?.title)}
                      </span>
                      <span style={{"display":"block","fontSize":"11px","color":"var(--dim)","marginTop":"2px"}}>
                        {txt(t?.meta)}
                      </span>
                    </span>
                    <button className="ixm" onClick={t?.remove} title="Remove" style={{"flex":"none","width":"24px","height":"24px","border":"1px solid var(--border)","borderRadius":"8px","background":"var(--surface-2)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M6 6l12 12 M18 6 6 18" />
                      </svg>
                    </button>
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
