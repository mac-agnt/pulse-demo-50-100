import { Fragment } from "react";
import { arr, cat, css, txt } from "../../runtime/template";

type Props = { v: any };

export default function WorkViewer({ v }: Props) {
  return (
    <>
      <div onClick={v.workViewer?.close} style={{"position":"fixed","inset":"0","zIndex":"60","background":"var(--scrim)","backdropFilter":"blur(30px) saturate(1.2)","animation":"scrimIn .3s var(--ease) both"}} />
      <div style={{"position":"fixed","inset":"0","zIndex":"61","display":"flex","alignItems":"center","justifyContent":"center","padding":"30px 24px","pointerEvents":"none"}}>
        <div style={{"pointerEvents":"auto","width":"min(880px,100%)","maxHeight":"min(86vh,900px)","display":"flex","flexDirection":"column","background":"var(--overlay)","border":"1px solid var(--border-strong)","borderRadius":"var(--card-r,18px)","boxShadow":"0 44px 120px rgba(0,0,0,.6),inset 0 1px 0 var(--glass-highlight)","backdropFilter":"blur(40px) saturate(1.4)","overflow":"hidden","animation":"panelIn .4s cubic-bezier(.16,1,.3,1) both"}}>
          <div style={{"flex":"none","padding":"20px 24px 16px","borderBottom":"1px solid var(--border)"}}>
            <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
              <span style={{"width":"26px","height":"26px","flex":"none","borderRadius":"var(--r-sm,9px)","background":"var(--accent-faint)","border":"1px solid var(--accent-line)","color":"var(--accent)","display":"flex","alignItems":"center","justifyContent":"center"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={v.workViewer?.kindIcon} />
                </svg>
              </span>
              <span style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.14em","color":"var(--accent)"}}>
                {txt(v.workViewer?.label)}
              </span>
              <span style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.1em","color":"var(--faint)"}}>
                {txt(v.workViewer?.age)}
              </span>
              <span style={css(v.workViewer?.effectStyle)}>
                {txt(v.workViewer?.effectCount)}
              </span>
              <span style={{"flex":"1"}} />
              <button className="ixm" onClick={v.workViewer?.close} aria-label="Close" style={{"width":"28px","height":"28px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,10px)","background":"var(--surface)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M6 6l12 12 M18 6 6 18" />
                </svg>
              </button>
            </div>
            <div style={{"fontSize":"19px","fontWeight":"500","letterSpacing":"-.5px","marginTop":"9px"}}>
              {txt(v.workViewer?.title)}
            </div>
            <div style={{"fontSize":"12.5px","color":"var(--dim)","marginTop":"4px"}}>
              {txt(v.workViewer?.subject)}
            </div>
            {v.workViewer?.hasFacts && (
              <>
                <div style={{"display":"flex","flexWrap":"wrap","gap":"10px","marginTop":"14px"}}>
                  {arr(v.workViewer?.facts).map((f: any, i121: number) => (
                    <Fragment key={i121}>
                      <div style={{"flex":"1 1 140px","minWidth":"0","padding":"10px 13px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-md,13px)"}}>
                        <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.12em","color":"var(--faint)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                          {txt(f?.label)}
                        </div>
                        <div style={{"fontSize":"14px","color":"var(--ink)","marginTop":"5px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                          {txt(f?.value)}
                        </div>
                      </div>
                    </Fragment>
                  ))}
                </div>
              </>
            )}
            <div style={{"display":"flex","gap":"4px","marginTop":"14px","padding":"3px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"6px","width":"fit-content"}}>
              {arr(v.workViewer?.tabs).map((t: any, i122: number) => (
                <Fragment key={i122}>
                  <button onClick={t?.pick} style={css(t?.style)}>
                    {txt(t?.label)}
                  </button>
                </Fragment>
              ))}
            </div>
          </div>
          <div data-scroll-work="" style={{"flex":"1","minHeight":"0","overflowY":"auto","padding":"20px 24px 24px"}}>
            {v.workViewer?.onWork && (
              <>
                <div style={{"padding":"18px 20px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","animation":"expandIn .28s var(--ease) both"}}>
                  <div style={{"fontSize":"15px","fontWeight":"500","letterSpacing":"-.3px"}}>
                    {txt(v.workViewer?.headline)}
                  </div>
                  <div style={{"fontSize":"12px","color":"var(--dim)","marginTop":"4px"}}>
                    {txt(v.workViewer?.sub)}
                  </div>
                  {v.workViewer?.isDoc && (
                    <>
                      <div style={{"display":"flex","flexDirection":"column","gap":"16px","marginTop":"18px","paddingTop":"16px","borderTop":"1px solid var(--border)"}}>
                        {arr(v.workViewer?.doc).map((d: any, i123: number) => (
                          <Fragment key={i123}>
                            <div>
                              <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--faint)"}}>
                                {txt(d?.heading)}
                              </div>
                              <div style={{"fontSize":"13.5px","lineHeight":"1.68","color":"var(--body)","marginTop":"7px","textWrap":"pretty"}}>
                                {txt(d?.body)}
                              </div>
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </>
                  )}
                  {v.workViewer?.isTable && (
                    <>
                      <div style={{"marginTop":"16px","border":"1px solid var(--border)","borderRadius":"var(--r-sm,9px)","overflow":"hidden"}}>
                        <table style={{"width":"100%","borderCollapse":"collapse"}}>
                          <thead>
                            <tr style={{"background":"var(--surface-2)"}}>
                              {arr(v.workViewer?.cols).map((c: any, i124: number) => (
                                <Fragment key={i124}>
                                  <th style={css(c?.style)}>
                                    {txt(c?.label)}
                                  </th>
                                </Fragment>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {arr(v.workViewer?.rows).map((r: any, i125: number) => (
                              <Fragment key={i125}>
                                <tr style={css(r?.style)}>
                                  {arr(r?.cells).map((c: any, i126: number) => (
                                    <Fragment key={i126}>
                                      <td style={css(c?.style)}>
                                        {txt(c?.v)}
                                      </td>
                                    </Fragment>
                                  ))}
                                </tr>
                              </Fragment>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                  {v.workViewer?.isDiff && (
                    <>
                      <div style={{"display":"flex","flexDirection":"column","gap":"8px","marginTop":"16px"}}>
                        {arr(v.workViewer?.diff).map((d: any, i127: number) => (
                          <Fragment key={i127}>
                            <div style={css(d?.rowStyle)}>
                              <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","color":"var(--dim)"}}>
                                {txt(d?.field)}
                              </span>
                              <span style={css(d?.fromStyle)}>
                                {txt(d?.from)}
                              </span>
                              {d?.changed && (
                                <>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none"}}>
                                    <path d="M5 12h13 M13 6.5 18.5 12 13 17.5" />
                                  </svg>
                                  <span style={css(d?.toStyle)}>
                                    {txt(d?.to)}
                                  </span>
                                </>
                              )}
                              {d?.same && (
                                <>
                                  <span style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.1em","color":"var(--faint)"}}>
                                    {"UNCHANGED"}
                                  </span>
                                </>
                              )}
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </>
                  )}
                  {v.workViewer?.hasTotals && (
                    <>
                      <div style={{"marginTop":"16px"}}>
                        {arr(v.workViewer?.totals).map((t: any, i128: number) => (
                          <Fragment key={i128}>
                            <div style={css(t?.style)}>
                              <span style={css(t?.labelStyle)}>
                                {txt(t?.label)}
                              </span>
                              <span style={css(t?.valueStyle)}>
                                {txt(t?.value)}
                              </span>
                            </div>
                          </Fragment>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <div style={{"display":"flex","alignItems":"flex-start","gap":"11px","marginTop":"12px","padding":"14px 16px","background":"var(--warn-soft)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)"}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{"flex":"none","marginTop":"1px","color":"var(--ink)","opacity":".75"}}>
                    <path d="M12 4.8 21 20H3l9-15.2Z M12 10.5v4 M12 17h.01" />
                  </svg>
                  <span style={{"flex":"1","minWidth":"0","display":"block"}}>
                    <span style={{"display":"block","fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--ink)","opacity":".7"}}>
                      {"WHAT IS NOT COVERED"}
                    </span>
                    <span style={{"display":"block","fontSize":"12.5px","lineHeight":"1.6","color":"var(--ink)","marginTop":"5px"}}>
                      {txt(v.workViewer?.risk)}
                    </span>
                  </span>
                </div>
              </>
            )}
            {v.workViewer?.onThinking && (
              <>
                <div style={{"animation":"expandIn .28s var(--ease) both"}}>
                  <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--faint)"}}>
                    {"HOW IT GOT HERE"}
                  </div>
                  <div style={{"display":"flex","flexDirection":"column","gap":"2px","marginTop":"12px"}}>
                    {arr(v.workViewer?.thinking).map((t: any, i129: number) => (
                      <Fragment key={i129}>
                        <div style={{"display":"flex","gap":"13px"}}>
                          <span style={{"flex":"none","display":"flex","flexDirection":"column","alignItems":"center","width":"22px"}}>
                            <span style={{"width":"22px","height":"22px","borderRadius":"8px","background":"var(--accent-faint)","border":"1px solid var(--accent-line)","color":"var(--accent)","display":"flex","alignItems":"center","justifyContent":"center","fontFamily":"var(--mono)","fontSize":"9.5px"}}>
                              {txt(t?.n)}
                            </span>
                            <span style={{"flex":"1","width":"1px","background":"var(--border)","minHeight":"10px"}} />
                          </span>
                          <span style={{"flex":"1","minWidth":"0","display":"block","paddingBottom":"16px"}}>
                            <span style={{"display":"block","fontSize":"13.5px","color":"var(--ink)"}}>
                              {txt(t?.step)}
                            </span>
                            <span style={{"display":"block","fontSize":"12.5px","color":"var(--dim)","lineHeight":"1.6","marginTop":"3px"}}>
                              {txt(t?.detail)}
                            </span>
                          </span>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                  <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--faint)","marginTop":"6px"}}>
                    {"TOOLS THAT RAN OR WILL RUN"}
                  </div>
                  <div style={{"display":"flex","flexWrap":"wrap","gap":"7px","marginTop":"11px"}}>
                    {arr(v.workViewer?.tools).map((t: any, i130: number) => (
                      <Fragment key={i130}>
                        <span style={css(t?.style)}>
                          <span style={{"fontFamily":"var(--mono)","fontSize":"11.5px","color":"var(--body)"}}>
                            {txt(t?.name)}
                          </span>
                          <span style={css(t?.effectStyle)}>
                            {txt(t?.effect)}
                          </span>
                        </span>
                      </Fragment>
                    ))}
                  </div>
                  <div style={{"fontSize":"11.5px","color":"var(--faint)","lineHeight":"1.6","marginTop":"12px"}}>
                    {"Reads already ran. Anything marked write or external runs only after you approve."}
                  </div>
                </div>
              </>
            )}
            {v.workViewer?.onTrail && (
              <>
                <div style={{"animation":"expandIn .28s var(--ease) both"}}>
                  <div style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.13em","color":"var(--faint)"}}>
                    {"WHO IT PASSED THROUGH"}
                  </div>
                  <div style={{"display":"flex","flexDirection":"column","gap":"8px","marginTop":"12px"}}>
                    {arr(v.workViewer?.steps).map((s: any, i131: number) => (
                      <Fragment key={i131}>
                        <div style={{"display":"flex","alignItems":"center","gap":"11px","padding":"12px 14px","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--r-md,12px)"}}>
                          <span style={css(cat("width:7px;height:7px;flex:none;border-radius:2px;background:", s?.dot))} />
                          <span style={{"flex":"1","minWidth":"0","fontSize":"13px","color":"var(--ink)"}}>
                            {txt(s?.who)}
                          </span>
                          <span style={{"fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--faint)"}}>
                            {txt(s?.state)}
                          </span>
                        </div>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          <div style={{"flex":"none","display":"flex","alignItems":"center","gap":"10px","padding":"16px 24px","borderTop":"1px solid var(--border)","background":"var(--surface-faint)"}}>
            <span style={{"flex":"1","minWidth":"0","fontSize":"11.5px","color":"var(--faint)"}}>
              {txt(v.workViewer?.footer)}
            </span>
            {v.workViewer?.pending && (
              <>
                <button className="ixz" onClick={v.workViewer?.close} style={{"height":"34px","padding":"0 14px","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","background":"none","fontSize":"12.5px","color":"var(--ink)","cursor":"pointer","transition":"border-color .2s var(--ease)"}}>
                  {"Request changes"}
                </button>
                <button className="ixp" onClick={v.workViewer?.approve} style={{"height":"34px","padding":"0 18px","border":"0","borderRadius":"var(--cta-r,9px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"13px","fontWeight":"500","cursor":"pointer","transition":"background .2s var(--ease),transform .18s var(--ease)"}}>
                  {"Approve"}
                </button>
              </>
            )}
            {v.workViewer?.decided && (
              <>
                <span style={{"display":"flex","alignItems":"center","gap":"7px","height":"34px","padding":"0 15px","border":"1px solid var(--accent-line)","borderRadius":"var(--r-md,12px)","background":"var(--accent-faint)","fontSize":"12.5px","color":"var(--ink)"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12.5 4.5 4.5L19 7.5" />
                  </svg>
                  {"Decided"}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
