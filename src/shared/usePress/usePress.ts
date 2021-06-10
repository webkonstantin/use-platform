import { HTMLAttributes, useState, useMemo, useRef, useEffect } from 'react'

import { focusWithoutScrolling } from '../../libs/dom-utils'
import { useListeners } from '../../libs/useListeners'
import type { PressSource, PressEventHandler } from '../types'
import { isValidKeyboardEvent } from './utils/keyboard-event'
import { getTouchById, getTouchFromEvent } from './utils/touch-event'
import { disableTextSelection, restoreTextSelection } from './utils/text-selection'
import { BasePressEvent, createPressEvent } from './utils/createPressEvent'

export interface UsePressProps {
  disabled?: boolean
  onPressStart?: PressEventHandler<HTMLElement>
  onPressUp?: PressEventHandler<HTMLElement>
  onPressEnd?: PressEventHandler<HTMLElement>
  onPress?: PressEventHandler<HTMLElement>
}

export interface UsePressResult<T> {
  pressed: boolean
  pressProps: HTMLAttributes<T>
}

type PressCache = {
  currentPointerId: number | null
  currentPointerTarget: HTMLElement | null
  pressed: boolean
  pressStarted: boolean
}

export function usePress<T extends HTMLElement = HTMLElement>(
  props: UsePressProps,
): UsePressResult<T> {
  const { addListener, removeAllListeners } = useListeners()
  const [pressed, setPressed] = useState(false)
  const cacheRef = useRef<PressCache>({
    currentPointerId: null,
    currentPointerTarget: null,
    pressed: false,
    pressStarted: false,
  })
  const propsRef = useRef<UsePressProps>({})
  // Use ref as cache for reuse props inside memo hook.
  propsRef.current = {
    disabled: props.disabled,
    onPressStart: props.onPressStart,
    onPressUp: props.onPressUp,
    onPressEnd: props.onPressEnd,
    onPress: props.onPress,
  }

  const pressProps = useMemo(() => {
    const cache = cacheRef.current
    const { disabled, onPress, onPressEnd, onPressStart, onPressUp } = propsRef.current
    const props: HTMLAttributes<HTMLElement> = {
      onKeyDown: (event) => {
        if (isValidKeyboardEvent(event.nativeEvent)) {
          event.preventDefault()
          event.stopPropagation()

          if (!cache.pressed && !event.repeat) {
            triggerPressStart(createPressEvent(event, 'keyboard'))
          }
        }
      },

      // TODO: Register as global listener after keydown.
      onKeyUp: (event) => {
        if (isValidKeyboardEvent(event.nativeEvent) && !event.repeat) {
          triggerPressUp(createPressEvent(event, 'keyboard'))
          triggerPressEnd(createPressEvent(event, 'keyboard'))
        }
      },
    }

    const triggerPressStart = (event: BasePressEvent) => {
      if (disabled || cache.pressStarted) {
        return
      }

      setPressed(true)
      cache.pressStarted = true
      event.source
      onPressStart?.({ ...event, type: 'pressstart' })
    }

    const triggerPressUp = (event: BasePressEvent) => {
      if (disabled) {
        return
      }

      onPressUp?.({ ...event, type: 'pressup' })
    }

    const triggerPressEnd = (event: BasePressEvent, triggerOnPress = true) => {
      if (!cache.pressStarted) {
        return
      }

      setPressed(false)
      cache.pressStarted = false

      onPressEnd?.({ ...event, type: 'pressend' })

      if (triggerOnPress) {
        onPress?.({ ...event, type: 'press' })
      }
    }

    const attach = (target: HTMLElement, id: number) => {
      cache.currentPointerTarget = target
      cache.currentPointerId = id
      cache.pressed = true

      disableTextSelection()
      setPressed(true)
    }

    const detach = () => {
      if (cache.pressed) {
        cache.pressed = false

        restoreTextSelection()
        setPressed(false)
        removeAllListeners()
      }
    }

    if (typeof PointerEvent !== 'undefined') {
      const onPointerMove = (event: PointerEvent) => {
        // Calculate pointer target because event.target returns for ios always first target.
        const target = document.elementFromPoint(event.clientX, event.clientY)

        if (cache.currentPointerTarget?.contains(target)) {
          triggerPressStart(createPressEvent(event, event.pointerType as PressSource))
        } else {
          triggerPressEnd(createPressEvent(event, event.pointerType as PressSource), false)
        }
      }

      const onPointerUp = (event: PointerEvent) => {
        // Dispose press only if down and up pointer ids are matches.
        if (event.pointerId === cache.currentPointerId) {
          detach()

          const target = document.elementFromPoint(event.clientX, event.clientY)

          if (cache.currentPointerTarget?.contains(target)) {
            triggerPressUp(createPressEvent(event, event.pointerType as PressSource))
            triggerPressEnd(createPressEvent(event, event.pointerType as PressSource))
          }
        }
      }

      // Cancel event can be fired while scroll.
      const onPointerCancel = (event: PointerEvent) => {
        if (cache.pressed) {
          triggerPressEnd(createPressEvent(event, event.pointerType as PressSource), false)
        }
        detach()
      }

      props.onPointerDown = (event) => {
        // Handle only left clicks.
        if (event.button !== 0) {
          return
        }

        event.preventDefault()
        event.stopPropagation()

        if (!cache.pressed && !disabled) {
          focusWithoutScrolling(event.currentTarget)

          attach(event.currentTarget, event.pointerId)
          triggerPressStart(createPressEvent(event, event.pointerType as PressSource))

          addListener(document, 'pointermove', onPointerMove, false)
          addListener(document, 'pointerup', onPointerUp, false)
          addListener(document, 'pointercancel', onPointerCancel, false)
        }
      }
    } else {
      const onTouchMove = (event: TouchEvent) => {
        const touch = getTouchById(event, cache.currentPointerId)

        if (touch) {
          // Calculate pointer target because event.target returns for ios always first target.
          const target = document.elementFromPoint(touch.clientX, touch.clientY)

          if (cache.currentPointerTarget?.contains(target)) {
            triggerPressStart(createPressEvent(event, 'touch'))
          } else {
            triggerPressEnd(createPressEvent(event, 'touch'), false)
          }
        }
      }

      const onTouchEnd = (event: TouchEvent) => {
        const touch = getTouchById(event, cache.currentPointerId)

        // Dispose press only if down and up pointer ids are matches.
        if (touch?.identifier === cache.currentPointerId) {
          detach()

          const target = document.elementFromPoint(touch.clientX, touch.clientY)

          if (cache.currentPointerTarget?.contains(target)) {
            triggerPressUp(createPressEvent(event, 'touch'))
            triggerPressEnd(createPressEvent(event, 'touch'))
          }
        }
      }

      // Cancel event can be fired while scroll.
      const onTouchCancel = (event: TouchEvent) => {
        if (cache.pressed) {
          triggerPressEnd(createPressEvent(event, 'touch'), false)
        }
        detach()
      }

      props.onTouchStart = (event) => {
        event.preventDefault()
        event.stopPropagation()

        const touch = getTouchFromEvent(event.nativeEvent)

        if (touch && !cache.pressed && !disabled) {
          focusWithoutScrolling(event.currentTarget)

          attach(event.currentTarget, touch.identifier)
          triggerPressStart(createPressEvent(event, 'touch'))

          addListener(document, 'touchmove', onTouchMove, false)
          addListener(document, 'touchend', onTouchEnd, false)
          addListener(document, 'touchcancel', onTouchCancel, false)
        }
      }
    }

    return props
  }, [addListener, removeAllListeners])

  useEffect(() => {
    return restoreTextSelection
  }, [])

  return {
    pressed,
    pressProps,
  }
}
