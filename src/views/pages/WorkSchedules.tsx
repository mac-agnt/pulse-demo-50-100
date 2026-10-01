import { Fragment } from "react";
import { arr, cat, css, txt } from "../../runtime/template";

type Props = { v: any };

export default function WorkSchedules({ v }: Props) {
  return (
    <>
      <div style={{"display":"grid","gridTemplateColumns":"minmax(0,1.7fr) minmax(0,1fr) minmax(0,1fr)","gap":"14px","alignItems":"stretch"}}>
        <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"20px 22px 22px"}}>
          <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
            <div style={{"flex":"1","minWidth":"0"}}>
              <div style={{"fontSize":"15px","fontWeight":"600"}}>
                {txt(v.cal?.monthLabel)}
              </div>
              <div style={{"fontSize":"11.5px","color":"var(--dim)","marginTop":"3px"}}>
                {txt(v.cal?.hint)}
              </div>
            </div>
            <div style={{"display":"flex","alignItems":"center","gap":"2px","padding":"3px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"6px"}}>
              {arr(v.cal?.scopes).map((s: any, i35: number) => (
                <Fragment key={i35}>
                  <button onClick={s?.pick} style={css(s?.style)}>
                    {txt(s?.label)}
                  </button>
                </Fragment>
              ))}
            </div>
          </div>
          <div style={{"display":"grid","gridTemplateColumns":"repeat(7,1fr)","gap":"6px","marginTop":"18px"}}>
            {arr(v.cal?.dayNames).map((d: any, i36: number) => (
              <Fragment key={i36}>
                <div style={{"textAlign":"center","fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.08em","color":"var(--faint)"}}>
                  {txt(d)}
                </div>
              </Fragment>
            ))}
            {arr(v.cal?.days).map((d: any, i37: number) => (
              <Fragment key={i37}>
                <div onClick={d?.pick} style={css(d?.cellStyle)}>
                  <span style={css(d?.numStyle)}>
                    {txt(d?.date)}
                  </span>
                  {arr(d?.chips).map((ev: any, i38: number) => (
                    <Fragment key={i38}>
                      <span style={css(ev?.style)}>
                        {txt(ev?.label)}
                      </span>
                    </Fragment>
                  ))}
                  {d?.hasMore && (
                    <>
                      <span style={{"fontSize":"9.5px","color":"var(--faint)","paddingLeft":"2px"}}>
                        {txt(d?.moreLabel)}
                      </span>
                    </>
                  )}
                </div>
              </Fragment>
            ))}
          </div>
          <div style={{"display":"flex","flexWrap":"wrap","gap":"14px","marginTop":"16px"}}>
            {arr(v.cal?.legend).map((l: any, i39: number) => (
              <Fragment key={i39}>
                <div style={{"display":"flex","alignItems":"center","gap":"7px"}}>
                  <span style={css(cat("width:7px;height:7px;border-radius:2px;background:", l?.bg))} />
                  <span style={{"fontSize":"11px","color":"var(--dim)"}}>
                    {txt(l?.label)}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>
          <div style={{"display":"grid","gridTemplateColumns":"repeat(3,1fr)","gap":"9px","marginTop":"18px"}}>
            {arr(v.cal?.weekStats).map((s: any, i40: number) => (
              <Fragment key={i40}>
                <div style={{"padding":"12px 13px","background":"var(--surface-2)","border":"1px solid var(--border)","borderRadius":"var(--r-sm,9px)"}}>
                  <div style={{"fontSize":"11px","color":"var(--dim)"}}>
                    {txt(s?.label)}
                  </div>
                  <div style={{"fontFamily":"var(--mono)","fontSize":"19px","fontWeight":"var(--fig-weight,inherit)","letterSpacing":"-.5px","marginTop":"6px"}}>
                    {txt(s?.value)}
                  </div>
                  <div style={{"fontSize":"10.5px","color":"var(--faint)","marginTop":"4px","lineHeight":"1.4"}}>
                    {txt(s?.note)}
                  </div>
                </div>
              </Fragment>
            ))}
          </div>
          <div style={{"fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.13em","color":"var(--faint)","marginTop":"20px"}}>
            {"NEXT UP"}
          </div>
          <div style={{"marginTop":"4px"}}>
            {arr(v.cal?.nextUp).map((n: any, i41: number) => (
              <Fragment key={i41}>
                <div style={{"display":"flex","alignItems":"center","gap":"11px","padding":"11px 0","borderTop":"1px solid var(--border)"}}>
                  <span style={css(cat("width:3px;flex:none;height:22px;border-radius:8px;background:", n?.color))} />
                  <span style={{"flex":"1","minWidth":"0","fontSize":"12.5px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                    {txt(n?.name)}
                  </span>
                  <span style={{"flex":"none","fontSize":"11px","color":"var(--dim)"}}>
                    {txt(n?.owner)}
                  </span>
                  <span style={{"flex":"none","fontFamily":"var(--mono)","fontSize":"10.5px","color":"var(--faint)","minWidth":"64px","textAlign":"right"}}>
                    {txt(n?.when)}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
        <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"20px 22px 12px"}}>
          <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
            <span style={{"flex":"1","fontSize":"13.5px","fontWeight":"500"}}>
              {txt(v.cal?.agendaTitle)}
            </span>
            <span style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)"}}>
              {txt(v.cal?.load)}
            </span>
          </div>
          <div style={{"marginTop":"8px"}}>
            {arr(v.cal?.agenda).map((a: any, i42: number) => (
              <Fragment key={i42}>
                <div draggable="true" onDragStart={a?.drag} onDragOver={a?.over} onDrop={a?.drop} style={css(cat("display:flex;align-items:center;gap:11px;padding:11px 0;border-top:1px solid var(--border);cursor:grab;opacity:", a?.opacity, ";transition:opacity .2s var(--ease)"))}>
                  <span style={{"width":"38px","flex":"none","fontFamily":"var(--mono)","fontSize":"11px","color":"var(--faint)"}}>
                    {txt(a?.time)}
                  </span>
                  <span style={css(cat("width:3px;flex:none;height:26px;border-radius:var(--r-sm,9px);background:", a?.color))} />
                  <div style={{"flex":"1","minWidth":"0"}}>
                    <div style={{"fontSize":"12.5px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                      {txt(a?.name)}
                    </div>
                    <div style={{"fontSize":"10.5px","color":"var(--faint)","marginTop":"3px","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                      {txt(a?.owner)}
                    </div>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--faint)" strokeWidth="1.6" strokeLinecap="round" style={{"flex":"none"}}>
                    <path d="M9 6h.01 M15 6h.01 M9 12h.01 M15 12h.01 M9 18h.01 M15 18h.01" />
                  </svg>
                </div>
              </Fragment>
            ))}
          </div>
          {v.cal?.dragHint && (
            <>
              <div style={{"padding":"8px 0 10px","fontSize":"11px","color":"var(--faint)"}}>
                {"Drag a routine onto another to move it in the running order."}
              </div>
            </>
          )}
        </div>
        <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"6px 22px 10px"}}>
          <div style={{"padding":"16px 0 6px","fontFamily":"var(--mono)","fontSize":"9.5px","letterSpacing":"0.13em","color":"var(--faint)"}}>
            {"RECURRING ROUTINES"}
          </div>
          {arr(v.cal?.recurring).map((s: any, i43: number) => (
            <Fragment key={i43}>
              <div style={{"display":"flex","alignItems":"center","gap":"11px","padding":"13px 0","borderTop":"1px solid var(--border)"}}>
                <span style={css(s?.tileStyle)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 4v3 M16 4v3 M4.5 9.5h15 M6.4 6h11.2A1.9 1.9 0 0 1 19.5 8v10a1.9 1.9 0 0 1-1.9 1.9H6.4A1.9 1.9 0 0 1 4.5 18V8A1.9 1.9 0 0 1 6.4 6Z" />
                  </svg>
                </span>
                <div style={{"flex":"1","minWidth":"0"}}>
                  <div style={{"fontSize":"12.5px","lineHeight":"1.35","overflow":"hidden","textOverflow":"ellipsis","whiteSpace":"nowrap"}}>
                    {txt(s?.name)}
                  </div>
                  <div style={{"fontFamily":"var(--mono)","fontSize":"10px","color":"var(--faint)","marginTop":"3px"}}>
                    {txt(s?.cadence)}
                  </div>
                </div>
                <button onClick={s?.toggle} style={css(cat("width:34px;height:20px;flex:none;border:0;border-radius:7px;background:", s?.trackBg, ";cursor:pointer;padding:0;position:relative;transition:background .22s var(--ease)"))}>
                  <span style={css(cat("position:absolute;top:2.5px;left:", s?.knobLeft, ";width:15px;height:15px;border-radius:6px;background:", s?.knobBg, ";transition:left .24s var(--ease)"))} />
                </button>
              </div>
            </Fragment>
          ))}
          <div style={{"display":"flex","alignItems":"center","gap":"10px","padding":"16px 0 8px","borderTop":"1px solid var(--border)"}}>
            <span style={{"flex":"1","fontSize":"12px","color":"var(--faint)"}}>
              {txt(v.cal?.workload)}
            </span>
            <button className="ixu" onClick={v.ops?.schedule} style={{"height":"30px","display":"flex","alignItems":"center","gap":"7px","padding":"0 13px","background":"none","border":"1px dashed var(--border-strong)","borderRadius":"var(--r-ctl,9px)","fontSize":"12px","color":"var(--dim)","cursor":"pointer","transition":"border-color .2s var(--ease),color .2s var(--ease)"}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14 M5 12h14" />
              </svg>
              {"Schedule task"}
            </button>
          </div>
        </div>
      </div>
      <div style={{"background":"var(--surface)","border":"1px solid var(--border)","borderRadius":"var(--card-r,18px)","backdropFilter":"blur(20px) saturate(1.3)","boxShadow":"var(--card-shadow)","padding":"20px 22px 22px","marginTop":"14px"}}>
        <div style={{"display":"flex","alignItems":"center","gap":"10px"}}>
          <div style={{"flex":"1","minWidth":"0"}}>
            <div style={{"fontSize":"15px","fontWeight":"600"}}>
              {txt(v.cal?.monthTitle)}
            </div>
            <div style={{"fontSize":"11.5px","color":"var(--dim)","marginTop":"3px"}}>
              {"The whole month — every routine, automation and scheduled task."}
            </div>
          </div>
          <div style={{"display":"flex","flexWrap":"wrap","gap":"14px"}}>
            {arr(v.cal?.legend).map((l: any, i44: number) => (
              <Fragment key={i44}>
                <div style={{"display":"flex","alignItems":"center","gap":"7px"}}>
                  <span style={css(cat("width:7px;height:7px;border-radius:2px;background:", l?.bg))} />
                  <span style={{"fontSize":"11px","color":"var(--dim)"}}>
                    {txt(l?.label)}
                  </span>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
        <div style={{"display":"grid","gridTemplateColumns":"repeat(7,1fr)","gap":"6px","marginTop":"18px"}}>
          {arr(v.cal?.dayNames).map((d: any, i45: number) => (
            <Fragment key={i45}>
              <div style={{"textAlign":"center","fontFamily":"var(--mono)","fontSize":"9px","letterSpacing":"0.08em","color":"var(--faint)","paddingBottom":"2px"}}>
                {txt(d)}
              </div>
            </Fragment>
          ))}
          {arr(v.cal?.monthDays).map((d: any, i46: number) => (
            <Fragment key={i46}>
              <div onClick={d?.pick} style={css(d?.cellStyle)}>
                <span style={css(d?.numStyle)}>
                  {txt(d?.date)}
                </span>
                {arr(d?.chips).map((ev: any, i47: number) => (
                  <Fragment key={i47}>
                    <span style={css(ev?.style)}>
                      {txt(ev?.label)}
                    </span>
                  </Fragment>
                ))}
                {d?.hasMore && (
                  <>
                    <span style={{"fontSize":"9.5px","color":"var(--faint)","paddingLeft":"2px"}}>
                      {txt(d?.moreLabel)}
                    </span>
                  </>
                )}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </>
  );
}
