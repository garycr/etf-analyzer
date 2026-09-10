using System;
using System.IO;
using System.Text;
using System.Collections.Specialized;
using System.Collections.Generic;
using System.Globalization;
using System.Web;
using System.Xml;
using System.Text.RegularExpressions;
using Strategic.DataServices.Database;

namespace Strategic.DataServices.HtmlParser
{
    public class Extractor
    {
        public Extractor()
        {
        }

		/// <summary>
		/// This will extract a section of an Html document so we can then parse it
		/// </summary>
        public static List<Price> Extract(Stream stream)
        {
            StreamReader reader = new StreamReader(stream);
            return ExtractFromHtml(reader);
        }

        public static List<Price> Extract(StreamReader reader)
        {
            return ExtractFromHtml(reader);
        }

        private static List<Price> ExtractFromHtml(StreamReader stream)
        {
            string html = default(string);

            html = ((TextReader)stream).ReadToEnd();

            // use regular expression to get the html to be extracted
            Regex r;
            Match m;

            r = new Regex("<td class\\s*=\\s*\"yfnc_tabledata1\"\\s*n?o?w?r?a?p?\\s*align=\"right\">(.*?)</td>",
                RegexOptions.IgnoreCase | RegexOptions.Compiled);

            List<Price> prices = new List<Price>();

            DateTime priorDate = default(DateTime);
            m = r.Match(html);
            while (m.Success)
            {
                Price price = new Price();
                //PriceStruct price = new PriceStruct();
                price.Date = DateTime.Parse(m.Groups[1].Value); m = m.NextMatch();

                if (price.Date != priorDate)
                {
                    price.Open = Decimal.Parse(m.Groups[1].Value); m = m.NextMatch();
                    price.High = Decimal.Parse(m.Groups[1].Value); m = m.NextMatch();
                    price.Low = Decimal.Parse(m.Groups[1].Value); m = m.NextMatch();
                    price.Close = Decimal.Parse(m.Groups[1].Value); m = m.NextMatch();
                    price.Volume = long.Parse(m.Groups[1].Value.Replace(",", "")); m = m.NextMatch();
                    price.AdjustedClose = Decimal.Parse(m.Groups[1].Value); m = m.NextMatch();

                    prices.Add(price);
                }
                else
                {
                    m.NextMatch();
                }

                priorDate = price.Date;

            }
            
            return prices;
        }
    }
}
