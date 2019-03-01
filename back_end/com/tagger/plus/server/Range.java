
package com.tagger.plus.server;

/**
 * Range represents a range of bytes.
 * @author Tanishq Iyer
 * @version 0.4.1
 */
class Range 
{
    long start;
    long end;
    long length;
    long total;

    /**
     * Construct a byte range.
     * @param start Start of the byte range.
     * @param end End of the byte range.
     * @param total Total length of the byte source.
     */
    public Range(long start, long end, long total)
    {
        this.start = start;
        this.end = end;
        this.length = end - start + 1;
        this.total = total;
    }
}