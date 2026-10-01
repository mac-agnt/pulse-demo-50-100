import { Fragment } from "react";
import { arr, cat, css, txt } from "../../runtime/template";

type Props = { v: any };

export default function HomeWidgetRail({ v }: Props) {
  return (
    <>
      <aside style={{"position":"relative","zIndex":"1","width":"352px","flex":"none","minHeight":"0","overflowY":"auto","display":"flex","flexDirection":"column","gap":"14px","padding":"2px 0 6px 20px"}}>
        <div style={{"flex":"0 0 auto","minWidth":"0","overflow":"hidden","display":"flex","flexWrap":"nowrap","alignItems":"center","justifyContent":"space-between","gap":"4px","padding":"2px 0 4px","fontFamily":"var(--mono)"}}>
          {arr(v.flipUnits).map((u: any, i15: number) => (
            <Fragment key={i15}>
              <div style={{"display":"flex","flexWrap":"nowrap","alignItems":"center","gap":"3px"}}>
                {arr(u?.tiles).map((t: any, i16: number) => (
                  <Fragment key={i16}>
                    {t?.isColon && (
                      <>
                        <div style={{"display":"flex","flexDirection":"column","gap":"3px","padding":"0 1px"}}>
                          <span style={{"width":"2.5px","height":"2.5px","borderRadius":"2px","background":"var(--accent)","animation":"tickPulse 1s ease-in-out infinite"}} />
                          <span style={{"width":"2.5px","height":"2.5px","borderRadius":"2px","background":"var(--accent)","animation":"tickPulse 1s ease-in-out .1s infinite"}} />
                        </div>
                      </>
                    )}
                    {t?.isTile && (
                      <>
                        <span style={css(cat("position:relative;display:flex;align-items:center;justify-content:center;min-width:", t?.w, ";height:", t?.h, ";padding:0 3px;border-radius:var(--r-sm,9px);background:var(--flap);border:1px solid var(--border);box-shadow:0 3px 8px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.13);font-size:", t?.size, ";font-weight:500;letter-spacing:-0.3px;color:", t?.color, ";overflow:hidden;perspective:100px"))}>
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
        <div style={{"display":"flex","alignItems":"center","gap":"8px","padding":"0 4px"}}>
          <span style={{"flex":"1","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
            {txt(v.widgetHint)}
          </span>
          <button className="ixm" onClick={v.toggleBgMenu} title="Change background" style={css(v.bgButtonStyle)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" style={css(v.bgPlusStyle)}>
              <path d="M12 5v14 M5 12h14" />
            </svg>
          </button>
          <button onClick={v.toggleWidgetEdit} style={css(cat("height:26px;display:flex;align-items:center;gap:6px;padding:0 11px;background:", v.widgetEditBg, ";border:1px solid ", v.widgetEditBorder, ";border-radius:var(--r-ctl,9px);font-size:11.5px;color:", v.widgetEditColor, ";cursor:pointer;transition:background .2s var(--ease),border-color .2s var(--ease)"))}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h4L19 9a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6V20Z" />
            </svg>
            {txt(v.widgetEditLabel)}
          </button>
        </div>
        {v.widgetEdit && (
          <>
            <div style={{"padding":"14px 16px","background":"var(--surface)","border":"1px dashed var(--border-strong)","borderRadius":"var(--card-r,18px)","animation":"expandIn .28s var(--ease) both"}}>
              <div style={{"fontSize":"12.5px","color":"var(--dim)"}}>
                {"Add a widget"}
              </div>
              <div style={{"display":"flex","flexWrap":"wrap","gap":"7px","marginTop":"10px"}}>
                {arr(v.widgetChoices).map((w: any, i17: number) => (
                  <Fragment key={i17}>
                    <button className="ixe" onClick={w?.add} style={{"height":"30px","display":"flex","alignItems":"center","gap":"7px","padding":"0 12px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","fontSize":"12px","color":"var(--body)","cursor":"pointer","transition":"border-color .2s var(--ease),transform .18s var(--ease)"}}>
                      <span style={{"color":"var(--accent)"}}>
                        {"+"}
                      </span>
                      {txt(w?.label)}
                    </button>
                  </Fragment>
                ))}
                {v.noWidgetChoices && (
                  <>
                    <span style={{"fontSize":"12px","color":"var(--faint)"}}>
                      {"Every widget is on the board."}
                    </span>
                  </>
                )}
              </div>
            </div>
          </>
        )}
        {v.show?.inbox && (
          <>
            <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","transition":"transform .28s var(--ease),border-color .24s var(--ease),box-shadow .28s var(--ease)","padding":"20px 22px 10px"}}>
              <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
                <div style={{"flex":"1","fontSize":"13.5px","fontWeight":"500"}}>
                  {"Action inbox"}
                </div>
                <span style={{"height":"24px","display":"flex","alignItems":"center","padding":"0 10px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-sm,9px)","fontFamily":"var(--mono)","fontSize":"11px","color":"var(--dim)"}}>
                  {txt(v.inboxCount)}
                </span>
                {v.widgetEdit && (
                  <>
                    <button className="ixd" onClick={v.removeInbox} title="Remove widget" style={{"width":"24px","height":"24px","flex":"none","border":"1px solid var(--border)","borderRadius":"8px","background":"var(--surface-2)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M6 6l12 12 M18 6 6 18" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              <div style={{"marginTop":"8px"}}>
                {arr(v.inboxTop).map((i: any, i18: number) => (
                  <Fragment key={i18}>
                    <div onClick={i?.open} style={{"display":"flex","gap":"12px","padding":"12px 0","borderTop":"1px solid var(--border)","cursor":"pointer","transition":"background .2s var(--ease),padding-left .24s var(--ease)"}}>
                      <span style={css(cat("width:7px;height:7px;border-radius:2px;flex:none;margin-top:5px;background:", i?.dot))} />
                      <div style={{"flex":"1","minWidth":"0"}}>
                        <div style={{"fontSize":"13px","lineHeight":"1.4"}}>
                          {txt(i?.title)}
                        </div>
                        <div style={{"fontSize":"11.5px","color":"var(--dim)","marginTop":"3px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                          {txt(i?.why)}
                        </div>
                      </div>
                      <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--faint)"}}>
                        {txt(i?.age)}
                      </span>
                    </div>
                  </Fragment>
                ))}
                {v.inboxEmpty && (
                  <>
                    <div style={{"padding":"20px 0 24px","borderTop":"1px solid var(--border)","textAlign":"center","fontSize":"12.5px","color":"var(--dim)"}}>
                      {"Nothing needs you."}
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}
        {v.show?.work && (
          <>
            <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","transition":"transform .28s var(--ease),border-color .24s var(--ease),box-shadow .28s var(--ease)","padding":"20px 22px 12px"}}>
              <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
                <div style={{"flex":"1","fontSize":"13.5px","fontWeight":"500"}}>
                  {"My work"}
                </div>
                <span style={{"fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--faint)"}}>
                  {txt(v.taskSummary)}
                </span>
                {v.widgetEdit && (
                  <>
                    <button className="ixd" onClick={v.removeWork} title="Remove widget" style={{"width":"24px","height":"24px","flex":"none","border":"1px solid var(--border)","borderRadius":"8px","background":"var(--surface-2)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M6 6l12 12 M18 6 6 18" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              <div style={{"marginTop":"8px"}}>
                {arr(v.tasks).map((t: any, i19: number) => (
                  <Fragment key={i19}>
                    <div style={{"display":"flex","alignItems":"center","gap":"11px","padding":"10px 0","borderTop":"1px solid var(--border)"}}>
                      <button onClick={t?.toggle} style={css(cat("width:17px;height:17px;flex:none;border-radius:6px;border:1.5px solid ", t?.ring, ";background:", t?.fill, ";color:var(--on-accent);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0"))}>
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={css(cat("opacity:", t?.checkOpacity, ";transition:opacity .18s var(--ease)"))}>
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </button>
                      <span style={css(cat("flex:1;min-width:0;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:", t?.color, ";text-decoration:", t?.strike))}>
                        {txt(t?.title)}
                      </span>
                      <span style={css(cat("font-family:var(--mono);font-size:10.5px;color:", t?.dueColor))}>
                        {txt(t?.due)}
                      </span>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        )}
        {v.show?.kpi && (
          <>
            <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","transition":"transform .28s var(--ease),border-color .24s var(--ease),box-shadow .28s var(--ease)","padding":"20px 22px 22px"}}>
              <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
                <div style={{"flex":"1","fontSize":"13.5px","fontWeight":"500"}}>
                  {"Today's numbers"}
                </div>
                {v.widgetEdit && (
                  <>
                    <button className="ixd" onClick={v.removeKpi} title="Remove widget" style={{"width":"24px","height":"24px","flex":"none","border":"1px solid var(--border)","borderRadius":"8px","background":"var(--surface-2)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M6 6l12 12 M18 6 6 18" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              <div style={{"display":"grid","gridTemplateColumns":"1fr 1fr","gap":"10px","marginTop":"14px"}}>
                {arr(v.miniKpis).map((k: any, i20: number) => (
                  <Fragment key={i20}>
                    <div style={{"padding":"13px 14px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)"}}>
                      <div style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                        {txt(k?.label)}
                      </div>
                      <div style={{"fontSize":"19px","fontWeight":"500","letterSpacing":"-.6px","marginTop":"6px"}}>
                        {txt(k?.value)}
                      </div>
                      <div style={css(cat("font-size:11px;color:", k?.deltaColor, ";margin-top:4px"))}>
                        {txt(k?.delta)}
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        )}
        {v.show?.visits && (
          <>
            <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","transition":"transform .28s var(--ease),border-color .24s var(--ease),box-shadow .28s var(--ease)","padding":"20px 22px 10px"}}>
              <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
                <div style={{"flex":"1","fontSize":"13.5px","fontWeight":"500"}}>
                  {"Site visits this week"}
                </div>
                {v.widgetEdit && (
                  <>
                    <button className="ixd" onClick={v.removeVisits} title="Remove widget" style={{"width":"24px","height":"24px","flex":"none","border":"1px solid var(--border)","borderRadius":"8px","background":"var(--surface-2)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M6 6l12 12 M18 6 6 18" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              <div style={{"marginTop":"6px"}}>
                {arr(v.visitWidget).map((v: any, i21: number) => (
                  <Fragment key={i21}>
                    <div style={{"display":"flex","alignItems":"center","gap":"11px","padding":"11px 0","borderTop":"1px solid var(--border)"}}>
                      <span style={css(cat("width:7px;height:7px;border-radius:2px;flex:none;background:", v?.dot))} />
                      <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(v?.title)}
                      </span>
                      <span style={{"fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--faint)"}}>
                        {txt(v?.when)}
                      </span>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        )}
        {v.show?.activity && (
          <>
            <div style={{"background":"var(--surface-strong)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","transition":"transform .28s var(--ease),border-color .24s var(--ease),box-shadow .28s var(--ease)","padding":"20px 22px 10px"}}>
              <div style={{"display":"flex","alignItems":"center","gap":"9px"}}>
                <div style={{"flex":"1","fontSize":"13.5px","fontWeight":"500"}}>
                  {"Activity"}
                </div>
                <span style={{"width":"6px","height":"6px","borderRadius":"2px","background":"var(--accent)"}} />
                <span style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                  {"Events"}
                </span>
                {v.widgetEdit && (
                  <>
                    <button className="ixd" onClick={v.removeActivity} title="Remove widget" style={{"width":"24px","height":"24px","flex":"none","border":"1px solid var(--border)","borderRadius":"8px","background":"var(--surface-2)","color":"var(--dim)","cursor":"pointer","display":"flex","alignItems":"center","justifyContent":"center","transition":"color .2s var(--ease),border-color .2s var(--ease)"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                        <path d="M6 6l12 12 M18 6 6 18" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
              <div style={{"marginTop":"14px"}}>
                {arr(v.activity).map((a: any, i22: number) => (
                  <Fragment key={i22}>
                    <div style={{"display":"flex","gap":"11px","paddingBottom":"14px"}}>
                      <span style={css(cat("width:6px;height:6px;border-radius:2px;flex:none;margin-top:6px;background:", a?.dot))} />
                      <div style={{"minWidth":"0","flex":"1"}}>
                        <div style={{"fontSize":"12.5px","lineHeight":"1.5","color":"var(--body)"}}>
                          <span style={{"color":"var(--ink)"}}>
                            {txt(a?.who)}
                          </span>
                          {" "}
                          {txt(a?.what)}
                        </div>
                        <div style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)","marginTop":"3px"}}>
                          {txt(a?.event)}
                          {" · "}
                          {txt(a?.when)}
                        </div>
                      </div>
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
