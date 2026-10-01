import { Fragment } from "react";
import { arr, cat, css, txt } from "../../runtime/template";
import AgentFace from "../../components/AgentFace";

type Props = { v: any };

export default function Agents({ v }: Props) {
  return (
    <>
      <div style={{"display":"flex","height":"100%","minHeight":"0","animation":"riseIn .4s var(--ease) both"}}>
        <div style={{"width":"320px","flex":"none","minHeight":"0","display":"flex","flexDirection":"column","borderRight":"1px solid var(--border)","overflow":"hidden"}}>
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"10px","padding":"16px 16px 10px"}}>
            <span style={{"flex":"1","fontSize":"20px","fontWeight":"600","letterSpacing":"-.4px"}}>
              {"Agents"}
            </span>
            <button className="ixm" onClick={v.openBuilder} title="New agent" style={{"width":"36px","height":"36px","border":"1px solid var(--border)","borderRadius":"999px","background":"var(--surface)","color":"var(--body)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9 M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </button>
          </div>
          <div style={{"flex":"none","padding":"0 16px 10px"}}>
            <div className="ix17" style={{"display":"flex","alignItems":"center","gap":"9px","height":"38px","padding":"0 14px","background":"var(--surface-2)","border":"1px solid transparent","borderRadius":"999px","transition":"border-color .22s var(--ease)"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.9" strokeLinecap="round" style={{"flex":"none"}}>
                <path d="m21 21-4.3-4.3 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0" />
              </svg>
              <input value={v.agentQuery ?? ""} onChange={v.setAgentQuery} placeholder="Search" style={{"flex":"1","minWidth":"0","border":"0","outline":"0","background":"none","fontSize":"14px","color":"var(--ink)"}} />
              {v.agentQueryOn && (
                <>
                  <button className="ix3" onClick={v.clearAgentQuery} title="Clear" style={{"flex":"none","width":"18px","height":"18px","border":"0","borderRadius":"999px","background":"var(--track)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center"}}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M6 6l12 12 M18 6 6 18" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>
          <div style={{"flex":"1","minHeight":"0","overflowY":"auto","padding":"0 8px 10px"}}>
            {arr(v.agentList).map((a: any, i110: number) => (
              <Fragment key={i110}>
                <div className="ixh" onClick={a?.open} style={css(a?.rowStyle)}>
                  {a?.unread && (
                    <>
                      <span style={{"position":"absolute","left":"8px","top":"30px","width":"8px","height":"8px","borderRadius":"999px","background":"var(--accent)"}} />
                    </>
                  )}
                  <span style={{"flex":"none","width":"48px","height":"44px","display":"flex","alignItems":"center","justifyContent":"center"}}>
                    {a?.isGroup && (
                      <>
                        {arr(a?.stack).map((s: any, i111: number) => (
                          <Fragment key={i111}>
                            <span style={css(s?.style)}>
                              <AgentFace shape={s?.shape} state={s?.state} tint={s?.tint} size={"24"} />
                            </span>
                          </Fragment>
                        ))}
                      </>
                    )}
                    {a?.isSolo && (
                      <>
                        <AgentFace shape={a?.shape} state={a?.state} tint={a?.tint} size={"44"} />
                      </>
                    )}
                  </span>
                  <div style={{"flex":"1","minWidth":"0","paddingBottom":"13px","marginBottom":"-13px","borderBottom":"1px solid var(--border)"}}>
                    <div style={{"display":"flex","alignItems":"baseline","gap":"8px"}}>
                      <span style={{"flex":"1","minWidth":"0","fontSize":"14.5px","fontWeight":"600","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(a?.name)}
                      </span>
                      <span style={{"flex":"none","fontSize":"12px","color":"var(--faint)"}}>
                        {txt(a?.when)}
                      </span>
                    </div>
                    <div style={{"fontSize":"13px","lineHeight":"1.4","color":"var(--dim)","marginTop":"3px","display":"-webkit-box","WebkitLineClamp":"2","WebkitBoxOrient":"vertical","overflow":"hidden"}}>
                      {txt(a?.preview)}
                    </div>
                  </div>
                </div>
              </Fragment>
            ))}
            {v.agentListEmpty && (
              <>
                <div style={{"padding":"40px 18px","textAlign":"center","fontSize":"12.5px","color":"var(--dim)"}}>
                  {"No agent matches that search."}
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{"position":"relative","flex":"1","minWidth":"0","minHeight":"0","display":"flex","flexDirection":"column","overflow":"hidden"}}>
          <div style={{"position":"relative","zIndex":"2","flex":"none","display":"flex","flexDirection":"column","alignItems":"center","gap":"6px","padding":"14px 70px 12px","textAlign":"center","background":"linear-gradient(var(--panel,#0f1316) 55%,transparent)"}}>
            <AgentFace shape={v.agent?.shape} state={v.agent?.state} tint={v.agent?.tint} size={"48"} />
            <div style={{"minWidth":"0","maxWidth":"100%","display":"flex","flexDirection":"column","alignItems":"center"}}>
              {v.agent?.isGroup && (
                <>
                  <input value={v.groupName ?? ""} onChange={v.setGroupName} placeholder="Name this group" style={{"width":"240px","maxWidth":"100%","textAlign":"center","border":"0","outline":"0","background":"none","fontSize":"14.5px","fontWeight":"600","padding":"0","transition":"color .2s var(--ease)"}} />
                  <div style={{"display":"flex","alignItems":"center","justifyContent":"center","gap":"8px","marginTop":"4px"}}>
                    <div style={{"display":"flex","alignItems":"center"}}>
                      {arr(v.groupMembers).map((m: any, i112: number) => (
                        <Fragment key={i112}>
                          <span style={css(m?.chipStyle)}>
                            <AgentFace shape={m?.shape} state={m?.state} tint={m?.tint} size={"22"} />
                          </span>
                        </Fragment>
                      ))}
                    </div>
                    <span style={{"fontSize":"11.5px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                      {txt(v.agent?.role)}
                    </span>
                  </div>
                </>
              )}
              {v.agent?.isSolo && (
                <>
                  <button className="ix11" onClick={v.openBuilderForAgent} style={{"display":"flex","alignItems":"center","gap":"4px","height":"26px","padding":"0 10px","border":"0","borderRadius":"999px","background":"var(--surface-strong)","fontSize":"13px","fontWeight":"600","color":"var(--ink)","cursor":"pointer"}}>
                    {txt(v.agent?.name)}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </button>
                  <div style={{"fontSize":"11.5px","color":"var(--faint)","marginTop":"4px","maxWidth":"100%","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                    {txt(v.agent?.role)}
                  </div>
                </>
              )}
            </div>
            <button className="ix10" onClick={v.openBuilderForAgent} title="Tune" style={{"position":"absolute","right":"16px","top":"14px","width":"40px","height":"40px","padding":"0","display":"flex","alignItems":"center","justifyContent":"center","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"999px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2v.17a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.96-1.14l-.06.06A2 2 0 1 1 4.16 17l.06-.06A1.7 1.7 0 0 0 3 14.04H2.9a2 2 0 1 1 0-4h.17A1.7 1.7 0 0 0 4.22 7.1l-.06-.06A2 2 0 1 1 7 4.21l.06.06a1.7 1.7 0 0 0 2.9-1.2V2.9a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.9 1.2l.06-.06A2 2 0 1 1 19.75 7l-.06.06A1.7 1.7 0 0 0 21 10.04h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z" />
              </svg>
            </button>
          </div>
          <div style={{"flex":"1","minHeight":"0","overflowY":"auto","padding":"8px 24px 16px"}}>
            {arr(v.agentThread).map((m: any, i113: number) => (
              <Fragment key={i113}>
                <div style={css(m?.wrapStyle)}>
                  {m?.isStamp && (
                    <>
                      <div style={{"width":"100%","textAlign":"center","fontSize":"12px","fontWeight":"600","color":"var(--faint)","padding":"14px 0 10px"}}>
                        {txt(m?.text)}
                      </div>
                    </>
                  )}
                  {m?.isRoutine && (
                    <>
                      <div style={{"width":"100%","display":"flex","alignItems":"center","justifyContent":"center","gap":"9px","padding":"6px 0 18px","fontSize":"12.5px","color":"var(--dim)"}}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 7.6V12l3 1.8" />
                        </svg>
                        {"\n"}
                        {txt(m?.text)}
                        <span style={{"color":"var(--ink)"}}>
                          {txt(m?.routine)}
                        </span>
                      </div>
                    </>
                  )}
                  {m?.isBubble && (
                    <>
                      <div style={css(cat("max-width:min(72%,560px);display:flex;flex-direction:column;gap:4px;align-items:", m?.alignItems))}>
                        {m?.hasSender && (
                          <>
                            <div style={{"display":"flex","alignItems":"center","gap":"7px","padding":"0 4px"}}>
                              <AgentFace shape={m?.senderShape} state={m?.senderState} tint={m?.senderTint} size={"20"} />
                              <span style={{"fontSize":"11.5px","fontWeight":"500","color":"var(--dim)"}}>
                                {txt(m?.sender)}
                              </span>
                            </div>
                          </>
                        )}
                        <div style={css(m?.bubbleStyle)}>
                          {txt(m?.text)}
                          {"\n"}
                          {m?.hasLines && (
                            <>
                              <div style={{"display":"flex","flexDirection":"column","gap":"7px","marginTop":"12px"}}>
                                {arr(m?.lines).map((l: any, i114: number) => (
                                  <Fragment key={i114}>
                                    <div style={{"display":"flex","gap":"9px","fontSize":"13.5px","lineHeight":"1.5"}}>
                                      <span style={{"flex":"none","color":"var(--accent)"}}>
                                        {"✓"}
                                      </span>
                                      <span>
                                        <span style={{"fontWeight":"500"}}>
                                          {txt(l?.k)}
                                        </span>
                                        {" "}
                                        <span style={{"color":"var(--faint)"}}>
                                          {"→"}
                                        </span>
                                        {" "}
                                        {txt(l?.v)}
                                      </span>
                                    </div>
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
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"10px","padding":"10px 16px 16px"}}>
            <button className="ixm" onClick={v.openBuilder} title="Attach or create" style={{"width":"40px","height":"40px","flex":"none","border":"1px solid var(--border)","borderRadius":"999px","background":"var(--surface)","color":"var(--body)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14 M5 12h14" />
              </svg>
            </button>
            <div className="ix17" style={{"flex":"1","minWidth":"0","display":"flex","alignItems":"center","gap":"8px","height":"40px","padding":"0 5px 0 16px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"999px","transition":"border-color .22s var(--ease)"}}>
              <input value={v.agentDraft ?? ""} onChange={v.setAgentDraft} onKeyDown={v.onAgentKey} placeholder={v.agentPlaceholder} style={{"flex":"1","minWidth":"0","border":"0","outline":"0","background":"none","fontSize":"14.5px"}} />
              <button onClick={v.agentPrimary} title={v.agentPrimaryTitle} style={css(v.agentPrimaryStyle)}>
                <span style={{"position":"relative","width":"15px","height":"15px","flex":"none","display":"block"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={css(v.agentMicStyle)}>
                    <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Z M6 11a6 6 0 0 0 12 0 M12 17v3" />
                  </svg>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" style={css(v.agentSendStyle)}>
                    <path d="M12 19V5 M5 12l7-7 7 7" />
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
