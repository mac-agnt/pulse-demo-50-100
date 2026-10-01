import { Fragment } from "react";
import { arr, cat, css, cx, pc, txt } from "../../runtime/template";

type Props = { v: any };

export default function Dashboard({ v }: Props) {
  return (
    <>
      <div style={{"width":"100%","maxWidth":"1280px","margin":"0 auto","boxSizing":"border-box","padding":"22px 32px 40px","animation":"pageIn .7s var(--ease) both"}}>
        <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"18px 4px 16px"}}>
          <div style={css(v.aspectTrack)}>
            <span style={css(v.aspectThumb)} />
            {arr(v.aspects).map((a: any, i90: number) => (
              <Fragment key={i90}>
                {a?.active && (
                  <>
                    <button onClick={a?.pick} style={{"position":"relative","zIndex":"1","display":"flex","alignItems":"center","justifyContent":"center","gap":"8px","height":"32px","padding":"0 15px","border":"0","borderRadius":"var(--r-ctl,11px)","cursor":"pointer","fontSize":"12.5px","fontWeight":"600","whiteSpace":"nowrap","background":"none","color":"var(--pill-ink)","transition":"color .3s var(--ease)"}}>
                      <span style={css(cat("width:7px;height:7px;border-radius:2px;background:", a?.color))} />
                      {txt(a?.label)}
                    </button>
                  </>
                )}
                {a?.inactive && (
                  <>
                    <button className="ix3" onClick={a?.pick} style={{"position":"relative","zIndex":"1","display":"flex","alignItems":"center","justifyContent":"center","gap":"8px","height":"32px","padding":"0 15px","border":"0","borderRadius":"var(--r-ctl,11px)","cursor":"pointer","fontSize":"12.5px","whiteSpace":"nowrap","background":"none","color":"var(--dim)","transition":"color .3s var(--ease)"}}>
                      <span style={{"width":"7px","height":"7px","borderRadius":"2px","background":"var(--track)"}} />
                      {txt(a?.label)}
                    </button>
                  </>
                )}
              </Fragment>
            ))}
          </div>
          <button className="ixe" onClick={v.toggleFilterMenu} style={{"flex":"none","height":"42px","display":"flex","alignItems":"center","gap":"7px","padding":"0 16px","background":"var(--surface)","border":"1px dashed var(--border-strong)","borderRadius":"999px","fontSize":"12.5px","color":"var(--dim)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease),transform .18s var(--ease)"}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14 M5 12h14" />
            </svg>
            {"Add filter"}
          </button>
        </div>
        {v.filterMenuOpen && (
          <>
            <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"18px 20px 20px","margin":"0 4px 18px","animation":"expandIn .28s var(--ease) both"}}>
              <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
                <div style={{"flex":"1","fontSize":"13.5px","fontWeight":"500"}}>
                  {"Filter across the business"}
                </div>
                <button onClick={v.toggleFilterMenu} style={{"height":"26px","padding":"0 11px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-ctl,9px)","fontSize":"11.5px","color":"var(--dim)","cursor":"pointer"}}>
                  {"Close"}
                </button>
              </div>
              <div style={{"fontSize":"12.5px","color":"var(--dim)","marginTop":"6px"}}>
                {"Type anything about the business as a filter — a region, a project, a customer segment — and Pulse builds a live metric set for it. Pick a registered dimension below, or name your own."}
              </div>
              {arr(v.filterGroups).map((g: any, i91: number) => (
                <Fragment key={i91}>
                  <div style={{"marginTop":"16px"}}>
                    <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                      {txt(g?.title)}
                    </div>
                    <div style={{"display":"flex","flexWrap":"wrap","gap":"7px","marginTop":"9px"}}>
                      {arr(g?.items).map((i: any, i92: number) => (
                        <Fragment key={i92}>
                          <button onClick={i?.pick} style={css(i?.style)}>
                            {txt(i?.label)}
                          </button>
                        </Fragment>
                      ))}
                    </div>
                  </div>
                </Fragment>
              ))}
              <div style={{"display":"flex","gap":"8px","marginTop":"18px"}}>
                <input value={v.customFilter ?? ""} onChange={v.setCustomFilter} onKeyDown={v.onCustomFilterKey} placeholder="e.g. Scotland expansion, or Late supplier deliveries" style={{"flex":"1","minWidth":"0","height":"36px","padding":"0 15px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-md,13px)","outline":"0","fontSize":"13px"}} />
                <button className={cx("ixp", "ixq")} onClick={v.addCustomFilter} style={{"height":"36px","padding":"0 17px","border":"0","borderRadius":"var(--cta-r,9px)","background":"var(--accent-fill,var(--accent))","color":"var(--on-accent)","boxShadow":"var(--accent-glow,none)","fontSize":"13px","fontWeight":"500","cursor":"pointer","transition":"background .2s var(--ease),transform .18s var(--ease)"}}>
                  {"Build dashboard"}
                </button>
              </div>
            </div>
          </>
        )}
        <div style={{"animation":"riseIn .4s var(--ease) both"}}>
          <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"0 4px 14px"}}>
            <span style={css(cat("width:9px;height:9px;flex:none;border-radius:2px;background:", v.area?.color))} />
            <span style={{"fontSize":"17px","fontWeight":"500","letterSpacing":"-.4px"}}>
              {txt(v.area?.title)}
            </span>
            {v.area?.isCustom && (
              <>
                <span style={{"fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.1em","padding":"3px 8px","borderRadius":"var(--chip-r,6px)","background":"var(--accent-faint)","color":"var(--accent)","flex":"none"}}>
                  {txt(v.area?.customBadge)}
                </span>
              </>
            )}
            <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
              {txt(v.area?.description)}
            </span>
            <span style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)"}}>
              {txt(v.area?.owner)}
            </span>
          </div>
          <div style={css(v.area?.metricGrid)}>
            {arr(v.area?.metrics).map((m: any, i93: number) => (
              <Fragment key={i93}>
                <div className="ix16" style={css(m?.cardStyle)}>
                  <div style={{"display":"flex","alignItems":"baseline","gap":"8px"}}>
                    <span style={{"flex":"1","minWidth":"0","fontSize":"12px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                      {txt(m?.label)}
                    </span>
                    {m?.isHero && (
                      <>
                        <span style={css(cat("flex:none;font-family:var(--mono);font-size:8.5px;letter-spacing:0.14em;color:", v.area?.color))}>
                          {"LEAD"}
                        </span>
                      </>
                    )}
                  </div>
                  <div style={css(m?.valueStyle)}>
                    {txt(m?.value)}
                  </div>
                  <div style={{"display":"flex","alignItems":"center","gap":"7px","marginTop":"8px"}}>
                    <span style={css(cat("font-size:11.5px;color:", m?.deltaColor))}>
                      {txt(m?.delta)}
                    </span>
                    <span style={{"fontSize":"11px","color":"var(--faint)"}}>
                      {txt(m?.hint)}
                    </span>
                  </div>
                  <div style={css(m?.barsStyle)}>
                    {arr(m?.bars).map((b: any, i94: number) => (
                      <Fragment key={i94}>
                        <div style={css(cat("flex:1;border-radius:3px;height:", b?.h, ";background:", b?.bg, ";transform-origin:bottom;animation:growBar .5s var(--ease) both"))} />
                      </Fragment>
                    ))}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
          <div style={css(v.area?.mainGrid)}>
            <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"20px 22px 22px"}}>
              <div style={{"display":"flex","alignItems":"baseline","gap":"10px"}}>
                <span style={{"flex":"1","fontSize":"13.5px","fontWeight":"500"}}>
                  {txt(v.area?.chartTitle)}
                </span>
                <span style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)"}}>
                  {txt(v.area?.chartUnit)}
                </span>
              </div>
              <div style={{"marginTop":"18px"}}>
                {v.area?.isColumns && (
                  <>
                    <div style={{"display":"flex","alignItems":"flex-end","gap":"6px","height":"150px"}}>
                      {arr(v.area?.chart).map((c: any, i95: number) => (
                        <Fragment key={i95}>
                          <div style={{"flex":"1","minWidth":"0","display":"flex","flexDirection":"column","justifyContent":"flex-end","alignItems":"center","gap":"8px","height":"100%"}}>
                            <span style={css(cat("font-family:var(--mono);font-size:9px;color:var(--faint);opacity:", c?.labelOpacity))}>
                              {txt(c?.value)}
                            </span>
                            <div className={cx(pc("hover", cat("background:", v.area?.color)))} style={css(cat("width:100%;border-radius:var(--r-sm,9px) 5px 2px 2px;height:", c?.h, ";background:", c?.bg, ";transform-origin:bottom;animation:growBar .55s var(--ease) both;transition:background .2s var(--ease)"))} />
                            <span style={{"fontFamily":"var(--mono)","fontSize":"9px","color":"var(--faint)"}}>
                              {txt(c?.label)}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
                {v.area?.isArea && (
                  <>
                    <div style={{"position":"relative","height":"150px"}}>
                      <svg viewBox="0 0 600 150" preserveAspectRatio="none" style={{"width":"100%","height":"132px","display":"block","overflow":"visible"}}>
                        <defs>
                          <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={v.area?.color} stopOpacity="0.34" />
                            <stop offset="100%" stopColor={v.area?.color} stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        {arr(v.area?.gridLines).map((g: any, i96: number) => (
                          <Fragment key={i96}>
                            <line x1="0" y1={g?.y} x2="600" y2={g?.y} stroke="var(--border)" strokeWidth="1" />
                          </Fragment>
                        ))}
                        <path d={v.area?.areaPath} fill="url(#areaFill)" />
                        <path d={v.area?.linePath} fill="none" stroke={v.area?.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        {arr(v.area?.points).map((p: any, i97: number) => (
                          <Fragment key={i97}>
                            <circle cx={p?.x} cy={p?.y} r={p?.r} fill="var(--bg)" stroke={v.area?.color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                          </Fragment>
                        ))}
                      </svg>
                      <div style={{"display":"flex","justifyContent":"space-between","marginTop":"6px"}}>
                        {arr(v.area?.chart).map((c: any, i98: number) => (
                          <Fragment key={i98}>
                            <span style={{"flex":"1","textAlign":"center","fontFamily":"var(--mono)","fontSize":"9px","color":"var(--faint)"}}>
                              {txt(c?.label)}
                            </span>
                          </Fragment>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                {v.area?.isFunnel && (
                  <>
                    <div style={{"display":"flex","flexDirection":"column","gap":"10px"}}>
                      {arr(v.area?.funnel).map((s: any, i99: number) => (
                        <Fragment key={i99}>
                          <div style={{"display":"flex","alignItems":"center","gap":"12px"}}>
                            <span style={{"width":"96px","flex":"none","fontSize":"12px","color":"var(--dim)"}}>
                              {txt(s?.label)}
                            </span>
                            <div style={{"flex":"1","minWidth":"0","height":"32px","display":"flex","alignItems":"center","gap":"10px"}}>
                              <div style={css(cat("height:32px;border-radius:var(--r-sm,9px);flex:none;width:", s?.pct, ";background:", s?.bg, ";transform-origin:left;animation:sweep .55s var(--ease) both"))} />
                              <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"11.5px","color":"var(--ink)"}}>
                                {txt(s?.value)}
                              </span>
                            </div>
                            <span style={{"width":"118px","flex":"none","textAlign":"right","fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--faint)"}}>
                              {txt(s?.rate)}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
                {v.area?.isStacked && (
                  <>
                    <div style={{"display":"flex","alignItems":"flex-end","gap":"8px","height":"132px"}}>
                      {arr(v.area?.stacked).map((c: any, i100: number) => (
                        <Fragment key={i100}>
                          <div style={{"flex":"1","minWidth":"0","display":"flex","flexDirection":"column","justifyContent":"flex-end","alignItems":"center","gap":"7px","height":"100%"}}>
                            <div style={css(cat("width:100%;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;height:", c?.h, ";transform-origin:bottom;animation:growBar .55s var(--ease) both"))}>
                              {arr(c?.parts).map((p: any, i101: number) => (
                                <Fragment key={i101}>
                                  <div title={p?.title} style={css(cat("width:100%;flex:", p?.flex, ";border-radius:", p?.radius, ";background:", p?.bg))} />
                                </Fragment>
                              ))}
                            </div>
                            <span style={{"fontFamily":"var(--mono)","fontSize":"9px","color":"var(--faint)"}}>
                              {txt(c?.label)}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                    <div style={{"display":"flex","flexWrap":"wrap","gap":"14px","marginTop":"14px"}}>
                      {arr(v.area?.legend).map((l: any, i102: number) => (
                        <Fragment key={i102}>
                          <div style={{"display":"flex","alignItems":"center","gap":"7px"}}>
                            <span style={css(cat("width:8px;height:8px;border-radius:2px;background:", l?.bg))} />
                            <span style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                              {txt(l?.label)}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
                {v.area?.isRows && (
                  <>
                    <div style={{"display":"flex","flexDirection":"column","gap":"12px"}}>
                      {arr(v.area?.rows).map((r: any, i103: number) => (
                        <Fragment key={i103}>
                          <div style={{"display":"flex","alignItems":"center","gap":"12px"}}>
                            <span style={{"width":"132px","flex":"none","fontFamily":"var(--mono)","fontSize":"11px","color":"var(--body)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                              {txt(r?.label)}
                            </span>
                            <div style={{"flex":"1","minWidth":"0","height":"20px","background":"var(--track)","borderRadius":"7px","overflow":"hidden"}}>
                              <div style={css(cat("height:20px;border-radius:var(--r-sm,9px);width:", r?.pct, ";background:", r?.bg, ";transform-origin:left;animation:sweep .55s var(--ease) both"))} />
                            </div>
                            <span style={{"width":"62px","flex":"none","textAlign":"right","fontFamily":"var(--mono)","fontSize":"11.5px","color":"var(--ink)"}}>
                              {txt(r?.value)}
                            </span>
                          </div>
                        </Fragment>
                      ))}
                    </div>
                  </>
                )}
                {v.area?.isDots && (
                  <>
                    <div style={{"position":"relative","height":"150px"}}>
                      <svg viewBox="0 0 600 150" preserveAspectRatio="none" style={{"width":"100%","height":"132px","display":"block","overflow":"visible"}}>
                        <line x1="0" y1={v.area?.targetY} x2="600" y2={v.area?.targetY} stroke={v.area?.color} strokeWidth="1.5" strokeDasharray="5 5" vectorEffect="non-scaling-stroke" />
                        {arr(v.area?.dots).map((d: any, i104: number) => (
                          <Fragment key={i104}>
                            <line x1={d?.x} y1={d?.y} x2={d?.x} y2="150" stroke="var(--border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                            <circle cx={d?.x} cy={d?.y} r={d?.r} fill={d?.fill} stroke={d?.stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                          </Fragment>
                        ))}
                      </svg>
                      <div style={{"display":"flex","justifyContent":"space-between","alignItems":"center","marginTop":"6px"}}>
                        {arr(v.area?.chart).map((c: any, i105: number) => (
                          <Fragment key={i105}>
                            <span style={{"flex":"1","textAlign":"center","fontFamily":"var(--mono)","fontSize":"9px","color":"var(--faint)"}}>
                              {txt(c?.label)}
                            </span>
                          </Fragment>
                        ))}
                      </div>
                      <div style={{"display":"flex","alignItems":"center","gap":"7px","marginTop":"10px"}}>
                        <span style={css(cat("width:14px;height:0;border-top:1.5px dashed ", v.area?.color))} />
                        <span style={{"fontSize":"11.5px","color":"var(--dim)"}}>
                          {txt(v.area?.targetLabel)}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div style={{"display":"flex","flexDirection":"column","background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"20px 22px 22px"}}>
              <div style={{"display":"flex","alignItems":"baseline","gap":"10px"}}>
                <span style={{"flex":"1","fontSize":"13.5px","fontWeight":"500"}}>
                  {txt(v.area?.splitTitle)}
                </span>
                <span style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)"}}>
                  {txt(v.area?.splitUnit)}
                </span>
              </div>
              <div style={{"flex":"1","minHeight":"0","display":"flex","flexDirection":"column","justifyContent":"space-around","gap":"6px","marginTop":"14px"}}>
                {arr(v.area?.split).map((b: any, i106: number) => (
                  <Fragment key={i106}>
                    <div style={{"display":"flex","alignItems":"center","gap":"12px"}}>
                      <span style={{"width":"104px","flex":"none","fontSize":"12.5px","color":"var(--dim)","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                        {txt(b?.key)}
                      </span>
                      <div style={{"flex":"1","height":"6px","borderRadius":"2px","background":"var(--track)","overflow":"hidden"}}>
                        <div style={css(cat("height:6px;border-radius:2px;width:", b?.pct, ";background:", b?.color, ";transform-origin:left;animation:sweep .6s var(--ease) both"))} />
                      </div>
                      <span style={{"width":"52px","flex":"none","textAlign":"right","fontFamily":"var(--mono)","fontSize":"12px","color":"var(--body)"}}>
                        {txt(b?.value)}
                      </span>
                    </div>
                  </Fragment>
                ))}
              </div>
              <div style={{"display":"flex","alignItems":"baseline","gap":"8px","marginTop":"16px","paddingTop":"14px","borderTop":"1px solid var(--border)"}}>
                <span style={{"flex":"1","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.12em","color":"var(--faint)"}}>
                  {txt(v.area?.splitFootLabel)}
                </span>
                <span style={{"fontFamily":"var(--mono)","fontSize":"13px","color":"var(--ink)"}}>
                  {txt(v.area?.splitFootValue)}
                </span>
              </div>
            </div>
          </div>
          <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","marginTop":"12px","overflow":"hidden"}}>
            <div style={{"display":"grid","gridTemplateColumns":"1.6fr .9fr .9fr 1fr","background":"var(--surface)"}}>
              {arr(v.area?.tableCols).map((c: any, i107: number) => (
                <Fragment key={i107}>
                  <div style={{"padding":"13px 20px","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.1em","color":"var(--faint)","textTransform":"uppercase"}}>
                    {txt(c)}
                  </div>
                </Fragment>
              ))}
            </div>
            {arr(v.area?.table).map((r: any, i108: number) => (
              <Fragment key={i108}>
                <div className="ix11" style={{"display":"grid","gridTemplateColumns":"1.6fr .9fr .9fr 1fr","borderTop":"1px solid var(--border)","transition":"background .2s var(--ease)"}}>
                  {arr(r?.cells).map((c: any, i109: number) => (
                    <Fragment key={i109}>
                      <div style={css(cat("padding:14px 20px;min-width:0;font-family:", c?.font, ";font-size:13px;color:", c?.color, ";overflow:hidden;text-overflow:ellipsis;white-space:nowrap"))}>
                        {txt(c?.v)}
                      </div>
                    </Fragment>
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
