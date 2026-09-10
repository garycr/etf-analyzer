using System;
using System.Collections.Generic;
using System.Linq;
using System.Xml.Linq;
using System.Text;
using System.Web;
using System.Net;
using System.IO;
using Strategic.DataServices.Database;

namespace Strategic.DataServices.HtmlParser
{
   public class Requestor
    {

       public void GetPricesFromSource(XDocument xDoc, DateTime BeginDate, DateTime EndDate)
       {

           string gatewayUrl = @"http://finance.yahoo.com/q/hp?s=";

           // E.g. request for 10/1/2007 to 10/28/2007 daily prices for XLU looks like this
           // "http://finance.yahoo.com/q/hp?s=XLU&a=10&b=1&c=2007&d=10&e=28&f=2007&g=d"
           
           HttpWebResponse response = null;
           
           // Use XLinq to iterate through the XML document to figure out which 
           // Security symbols we are going to request
           var symbols = xDoc.Descendants("symbol");

           foreach (var q in symbols)
           {

               try
               {
                   StringBuilder sb = new StringBuilder();
                   sb.Append(gatewayUrl);

                   // "http://finance.yahoo.com/q/hp?s=XLU&a=10&b=1&c=2007&d=10&e=28&f=2007&g=d"
                   sb.Append(q.Value).Append("&a=").Append(BeginDate.Month-1).Append("&b=").Append(BeginDate.Day);
                   sb.Append("&c=").Append(BeginDate.Year).Append("&d=").Append(EndDate.Month-1);
                   sb.Append("&e=").Append(EndDate.Day).Append("&f=").Append(EndDate.Year).Append("&g=d");


                   HttpWebRequest request = (HttpWebRequest)WebRequest.Create(sb.ToString());
                   response = (HttpWebResponse)request.GetResponse();
                   Stream stream = response.GetResponseStream();

                   // Pass the stream to the document/parser and get a DOM back
                   List<Price> result = Extractor.Extract(stream);
                   stream.Close();

                   // Write to the database
                   ETFDb db = new ETFDb();
                   db.InsertPrices(result, q.Value);

               }
               finally
               {
                   if (response != null)
                   {
                       response.Close();
                   }
               }
           }
       }

    }
}
