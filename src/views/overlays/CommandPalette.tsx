import { Fragment } from "react";
import { arr, css, txt } from "../../runtime/template";

type Props = { v: any };

export default function CommandPalette({ v }: Props) {
  return (
    <>
      <div onClick={v.closePalette} style={{"position":"fixed","inset":"0","zIndex":"60","background":"var(--scrim)","backdropFilter":"blur(7px)","display":"flex","alignItems":"flex-start","justifyContent":"center","padding":"10vh 16px 0","animation":"scrimIn .2s linear both"}}>
        <div onClick={v.stop} style={{"width":"min(680px,100%)","maxHeight":"76vh","display":"flex","flexDirection":"column","background":"var(--overlay)","border":"1px solid var(--border-strong)","borderRadius":"var(--card-r,18px)","boxShadow":"0 40px 90px rgba(0,0,0,.6)","backdropFilter":"blur(24px) saturate(1.3)","overflow":"hidden","animation":"paletteIn .42s cubic-bezier(.16,1,.3,1) both"}}>
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"12px","padding":"17px 18px 13px"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="1.9" strokeLinecap="round" style={{"flex":"none"}}>
              <path d="m21 21-4.3-4.3 M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0" />
            </svg>
            <input value={v.query ?? ""} onChange={v.setQuery} onKeyDown={v.onQueryKey} autoFocus={true} placeholder="Search records, work, agents and actions" style={{"flex":"1","minWidth":"0","border":"0","outline":"0","fontSize":"15px","background":"none","color":"var(--ink)"}} />
            {v.hasQuery && (
              <>
                <button className="ix3" onClick={v.clearQuery} title="Clear" style={{"flex":"none","width":"22px","height":"22px","border":"0","borderRadius":"8px","background":"var(--surface-2)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center"}}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                    <path d="M6 6l12 12 M18 6 6 18" />
                  </svg>
                </button>
              </>
            )}
            <button className="ixm" onClick={v.closePalette} style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--faint)","border":"1px solid var(--border)","background":"none","borderRadius":"var(--chip-r,6px)","padding":"3px 7px","cursor":"pointer"}}>
              {"ESC"}
            </button>
          </div>
          {v.hasQuery && (
            <>
              <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"6px","padding":"0 18px 13px","borderBottom":"1px solid var(--border)","animation":"expandIn .24s var(--ease) both"}}>
                {arr(v.palScopes).map((sc: any, i154: number) => (
                  <Fragment key={i154}>
                    <button className="ix3" onClick={sc?.pick} style={css(sc?.style)}>
                      {txt(sc?.label)}
                      <span style={css(sc?.countStyle)}>
                        {txt(sc?.count)}
                      </span>
                    </button>
                  </Fragment>
                ))}
              </div>
            </>
          )}
          {v.palIsHome && (
            <>
              <div style={{"flex":"none","height":"1px","background":"var(--border)"}} />
            </>
          )}
          <div style={{"flex":"1","minHeight":"0","overflowY":"auto","padding":"6px 0 8px"}}>
            {v.palIsHome && (
              <>
                <div style={{"animation":"rowIn .34s var(--ease) 40ms both"}}>
                  <div style={{"display":"flex","alignItems":"center","gap":"9px","padding":"14px 20px 9px"}}>
                    <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                      {"ON THIS PAGE"}
                    </span>
                    <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
                    <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.1em","color":"var(--accent)"}}>
                      {txt(v.palPageLabel)}
                    </span>
                  </div>
                  <div style={{"display":"grid","gridTemplateColumns":"1fr 1fr","gap":"8px","padding":"0 18px 4px"}}>
                    {arr(v.palPage).map((p: any, i155: number) => (
                      <Fragment key={i155}>
                        <button onClick={p?.open} onMouseEnter={p?.hover} style={css(p?.style)}>
                          <span style={css(p?.iconStyle)}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                              <path d={p?.icon} />
                            </svg>
                          </span>
                          <span style={{"minWidth":"0","flex":"1","display":"block"}}>
                            <span style={{"display":"block","fontSize":"12.5px","lineHeight":"1.3","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                              {txt(p?.title)}
                            </span>
                            <span style={{"display":"block","fontSize":"11px","color":"var(--dim)","marginTop":"3px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                              {txt(p?.meta)}
                            </span>
                          </span>
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
                <div style={{"animation":"rowIn .34s var(--ease) 100ms both"}}>
                  <div style={{"display":"flex","alignItems":"center","gap":"9px","padding":"16px 20px 9px"}}>
                    <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                      {"FREQUENTLY USED"}
                    </span>
                    <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
                  </div>
                  <div style={{"display":"flex","flexWrap":"wrap","gap":"7px","padding":"0 18px"}}>
                    {arr(v.palFrequent).map((f: any, i156: number) => (
                      <Fragment key={i156}>
                        <button onClick={f?.open} onMouseEnter={f?.hover} style={css(f?.style)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none","opacity":".75"}}>
                            <path d={f?.icon} />
                          </svg>
                          {"\n"}
                          {txt(f?.title)}
                          <span style={css(f?.countStyle)}>
                            {txt(f?.count)}
                          </span>
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
                {v.palHasRecent && (
                  <>
                    <div style={{"animation":"rowIn .34s var(--ease) 160ms both"}}>
                      <div style={{"display":"flex","alignItems":"center","gap":"9px","padding":"18px 20px 6px"}}>
                        <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                          {"RECENT"}
                        </span>
                        <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
                        <button className="ix3" onClick={v.palClearRecent} style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.1em","color":"var(--faint)","background":"none","border":"0","padding":"0","cursor":"pointer"}}>
                          {"CLEAR"}
                        </button>
                      </div>
                      {arr(v.palRecentRows).map((r: any, i157: number) => (
                        <Fragment key={i157}>
                          <div onClick={r?.open} onMouseEnter={r?.hover} style={css(r?.rowStyle)}>
                            <span style={css(r?.iconStyle)}>
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                <path d={r?.icon} />
                              </svg>
                            </span>
                            <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                              {txt(r?.title)}
                            </span>
                            <span style={css(r?.enterStyle)}>
                              {"↵"}
                            </span>
                            <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
                              {txt(r?.when)}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
                <div style={{"animation":"rowIn .34s var(--ease) 220ms both"}}>
                  <div style={{"display":"flex","alignItems":"center","gap":"9px","padding":"18px 20px 9px"}}>
                    <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                      {"JUMP TO"}
                    </span>
                    <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
                  </div>
                  <div style={{"display":"flex","flexWrap":"wrap","gap":"7px","padding":"0 18px 4px"}}>
                    {arr(v.palJump).map((j: any, i158: number) => (
                      <Fragment key={i158}>
                        <button onClick={j?.open} onMouseEnter={j?.hover} style={css(j?.style)}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none","opacity":".75"}}>
                            <path d={j?.icon} />
                          </svg>
                          {"\n"}
                          {txt(j?.title)}
                        </button>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </>
            )}
            {v.hasQuery && (
              <>
                <div onClick={v.askHelios} onMouseEnter={v.hoverAsk} style={css(v.askRowStyle)}>
                  <span style={css(v.askIconStyle)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v3 M12 18v3 M4.5 12h3 M16.5 12h3 M6.7 6.7l2.1 2.1 M15.2 15.2l2.1 2.1 M17.3 6.7l-2.1 2.1 M8.8 15.2l-2.1 2.1" />
                    </svg>
                  </span>
                  <div style={{"minWidth":"0","flex":"1"}}>
                    <div style={{"fontSize":"13.5px","lineHeight":"1.35"}}>
                      {"Ask Helios"}
                    </div>
                    <div style={{"fontSize":"11.5px","color":"var(--dim)","marginTop":"2px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                      {txt(v.askPreview)}
                    </div>
                  </div>
                  <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":".08em","color":"var(--faint)"}}>
                    {"⌘↵"}
                  </span>
                </div>
              </>
            )}
            {v.hasQuery && (
              <>
                {arr(v.results).map((g: any, i159: number) => (
                  <Fragment key={i159}>
                    <div style={css(g?.anim)}>
                      <div style={{"display":"flex","alignItems":"center","gap":"8px","padding":"13px 20px 5px"}}>
                        <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.1em","textTransform":"uppercase","color":"var(--faint)"}}>
                          {txt(g?.group)}
                        </span>
                        <span style={{"flex":"1","height":"1px","background":"var(--border)"}} />
                        <span style={{"fontFamily":"var(--mono)","fontSize":"9.5px","color":"var(--faint)"}}>
                          {txt(g?.count)}
                        </span>
                      </div>
                      {arr(g?.items).map((r: any, i160: number) => (
                        <Fragment key={i160}>
                          <div onClick={r?.open} onMouseEnter={r?.hover} style={css(r?.rowStyle)}>
                            <span style={css(r?.iconStyle)}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                <path d={r?.icon} />
                              </svg>
                            </span>
                            <div style={{"minWidth":"0","flex":"1"}}>
                              <div style={{"fontSize":"13.5px","lineHeight":"1.35","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                                {txt(r?.pre)}
                                <span style={{"color":"var(--accent)","fontWeight":"500"}}>
                                  {txt(r?.match)}
                                </span>
                                {txt(r?.post)}
                              </div>
                              <div style={{"fontSize":"11.5px","color":"var(--dim)","marginTop":"2px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                                {txt(r?.meta)}
                              </div>
                            </div>
                            <span style={css(r?.enterStyle)}>
                              {"↵ OPEN"}
                            </span>
                            <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":".08em","color":"var(--faint)"}}>
                              {txt(r?.hint)}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </Fragment>
                ))}
                {v.noResults && (
                  <>
                    <div style={{"padding":"34px 20px","textAlign":"center"}}>
                      <div style={{"fontSize":"13.5px"}}>
                        {"Nothing you can see matches that"}
                      </div>
                      <div style={{"fontSize":"12px","color":"var(--dim)","marginTop":"6px"}}>
                        {"Results are filtered to your grants. Press ⌘↵ to ask Helios instead."}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"16px","padding":"11px 20px","borderTop":"1px solid var(--border)","fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)"}}>
            <span>
              {"↑↓ NAVIGATE"}
            </span>
            <span>
              {"↵ OPEN"}
            </span>
            <span>
              {"⌘↵ ASK HELIOS"}
            </span>
            <span style={{"flex":"1"}} />
            <span>
              {txt(v.palFooter)}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
